const ForumAnalytics = require('../../models/forum/ForumAnalytics');

/**
 * Track page views
 */
const trackPageView = (pageType) => {
  return async (req, res, next) => {
    try {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      
      await ForumAnalytics.findOneAndUpdate(
        { date, type: 'daily' },
        {
          $inc: {
            [`pageViews.${pageType}`]: 1,
            'pageViews.total': 1
          }
        },
        { upsert: true }
      );
      
      next();
    } catch (error) {
      console.error('Analytics error:', error);
      next(); // Don't block request if analytics fails
    }
  };
};

/**
 * Track user actions
 */
const trackAction = async (action, userId) => {
  try {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    
    const update = {
      $inc: {
        [`actions.${action}`]: 1
      }
    };
    
    // Track unique users
    if (userId) {
      update.$addToSet = { uniqueUsers: userId };
    }
    
    await ForumAnalytics.findOneAndUpdate(
      { date, type: 'daily' },
      update,
      { upsert: true }
    );
  } catch (error) {
    console.error('Analytics tracking error:', error);
  }
};

/**
 * Get analytics data
 */
const getAnalytics = async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    let startDate = new Date();
    switch (period) {
      case '24h':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }
    
    const analytics = await ForumAnalytics.find({
      date: { $gte: startDate },
      type: 'daily'
    }).sort({ date: 1 });
    
    // Aggregate data
    const totals = analytics.reduce((acc, day) => {
      acc.pageViews.total += day.pageViews.total || 0;
      acc.pageViews.topics += day.pageViews.topics || 0;
      acc.pageViews.categories += day.pageViews.categories || 0;
      acc.actions.topics += day.actions.topics || 0;
      acc.actions.posts += day.actions.posts || 0;
      acc.actions.likes += day.actions.likes || 0;
      acc.uniqueUsers.add(...(day.uniqueUsers || []));
      return acc;
    }, {
      pageViews: { total: 0, topics: 0, categories: 0 },
      actions: { topics: 0, posts: 0, likes: 0 },
      uniqueUsers: new Set()
    });
    
    res.json({
      success: true,
      data: {
        period,
        totals: {
          ...totals,
          uniqueUsers: totals.uniqueUsers.size
        },
        daily: analytics
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = {
  trackPageView,
  trackAction,
  getAnalytics
};