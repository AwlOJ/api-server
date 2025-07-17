const nodemailer = require('nodemailer');
const config = require('../../config');
const User = require('../../models/User');
const ForumProfile = require('../../models/forum/ForumProfile');

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Send notification email for new reply
 */
const sendReplyNotification = async (topicAuthorId, replierUsername, topicTitle, topicSlug) => {
  try {
    const author = await User.findById(topicAuthorId);
    const profile = await ForumProfile.findOne({ user: topicAuthorId });
    
    // Check if user wants email notifications
    if (!profile?.preferences?.emailNotifications) {
      return;
    }

    const mailOptions = {
      from: `"AwlOJ Forum" <${process.env.SMTP_USER}>`,
      to: author.email,
      subject: `New reply to your topic: ${topicTitle}`,
      html: `
        <h2>Hello ${author.username},</h2>
        <p><strong>${replierUsername}</strong> has replied to your topic:</p>
        <h3>${topicTitle}</h3>
        <p><a href="${config.clientOrigin}/forum/topics/${topicSlug}">View the reply</a></p>
        <hr>
        <p><small>You received this email because you have notifications enabled. 
        <a href="${config.clientOrigin}/forum/settings">Manage your preferences</a></small></p>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending reply notification:', error);
  }
};

/**
 * Send notification for mentioned users
 */
const sendMentionNotification = async (mentionedUserId, mentionerUsername, postContent, topicSlug) => {
  try {
    const user = await User.findById(mentionedUserId);
    const profile = await ForumProfile.findOne({ user: mentionedUserId });
    
    if (!profile?.preferences?.emailNotifications) {
      return;
    }

    const mailOptions = {
      from: `"AwlOJ Forum" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: `${mentionerUsername} mentioned you in a post`,
      html: `
        <h2>Hello ${user.username},</h2>
        <p><strong>${mentionerUsername}</strong> mentioned you in a post:</p>
        <blockquote>${postContent.substring(0, 200)}${postContent.length > 200 ? '...' : ''}</blockquote>
        <p><a href="${config.clientOrigin}/forum/topics/${topicSlug}">View the full post</a></p>
        <hr>
        <p><small>You received this email because you have notifications enabled. 
        <a href="${config.clientOrigin}/forum/settings">Manage your preferences</a></small></p>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending mention notification:', error);
  }
};

/**
 * Send welcome email for new forum user
 */
const sendWelcomeEmail = async (userId) => {
  try {
    const user = await User.findById(userId);
    
    const mailOptions = {
      from: `"AwlOJ Forum" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Welcome to AwlOJ Forum!',
      html: `
        <h2>Welcome ${user.username}!</h2>
        <p>Thank you for joining AwlOJ Forum. We're excited to have you in our community!</p>
        <h3>Getting Started:</h3>
        <ul>
          <li><a href="${config.clientOrigin}/forum">Browse Topics</a></li>
          <li><a href="${config.clientOrigin}/forum/profile/me">Complete Your Profile</a></li>
          <li><a href="${config.clientOrigin}/forum/rules">Read Community Guidelines</a></li>
        </ul>
        <p>Happy coding!</p>
        <p>The AwlOJ Team</p>
        <p>© 2025 longathelstan. Built with ❤️</p>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
};

/**
 * Send digest email with forum activity
 */
const sendWeeklyDigest = async (userId) => {
  try {
    const user = await User.findById(userId);
    const profile = await ForumProfile.findOne({ user: userId });
    
    if (!profile?.preferences?.emailNotifications) {
      return;
    }

    // Get popular topics from last week
    const Topic = require('../../models/forum/Topic');
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const popularTopics = await Topic.find({
      createdAt: { $gte: weekAgo }
    })
      .populate('author', 'username')
      .populate('category', 'name')
      .sort({ viewCount: -1, replyCount: -1 })
      .limit(5);

    if (popularTopics.length === 0) {
      return;
    }

    const topicsList = popularTopics.map(topic => `
      <li>
        <strong>${topic.title}</strong> by ${topic.author.username} in ${topic.category.name}
        <br>
        <small>${topic.viewCount} views, ${topic.replyCount} replies</small>
      </li>
    `).join('');

    const mailOptions = {
      from: `"AwlOJ Forum" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Your Weekly Forum Digest',
      html: `
        <h2>Hello ${user.username}!</h2>
        <p>Here are the most popular topics from this week:</p>
        <ul>
          ${topicsList}
        </ul>
        <p><a href="${config.clientOrigin}/forum">Visit Forum</a></p>
        <hr>
        <p><small>You received this email because you have notifications enabled. 
        <a href="${config.clientOrigin}/forum/settings">Unsubscribe</a></small></p>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending weekly digest:', error);
  }
};

/**
 * Parse mentions from post content
 */
const parseMentions = (content) => {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }
  
  return [...new Set(mentions)]; // Remove duplicates
};

/**
 * Process notifications for a new post
 */
const processPostNotifications = async (post, topic) => {
  try {
    // Notify topic author if someone replied
    if (post.author.toString() !== topic.author.toString()) {
      await sendReplyNotification(
        topic.author,
        post.author.username || 'Someone',
        topic.title,
        topic.slug
      );
    }

    // Check for mentions
    const mentions = parseMentions(post.content);
    if (mentions.length > 0) {
      const users = await User.find({ username: { $in: mentions } });
      
      for (const user of users) {
        if (user._id.toString() !== post.author.toString()) {
          await sendMentionNotification(
            user._id,
            post.author.username || 'Someone',
            post.content,
            topic.slug
          );
        }
      }
    }
  } catch (error) {
    console.error('Error processing post notifications:', error);
  }
};

module.exports = {
  sendReplyNotification,
  sendMentionNotification,
  sendWelcomeEmail,
  sendWeeklyDigest,
  parseMentions,
  processPostNotifications
};