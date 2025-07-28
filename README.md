# AwlOJ API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

Use JWT token in the header:

```
x-auth-token: <your-jwt-token>
```

---

## Authentication Routes (`/api/auth`)

### POST /api/auth/signup

Register a new user account.

**Request Body:**

```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response:**

```json
{
  "message": "User registered successfully"
}
```

### POST /api/auth/login

Login to your account.

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### GET /api/auth/me

Get current authenticated user info.

**Headers:**

```
x-auth-token: <jwt-token>
```

**Response:**

```json
{
  "_id": "...",
  "username": "johndoe",
  "email": "john@example.com",
  "role": "user",
  "createdAt": "2021-06-25T10:30:00.000Z"
}
```

---

## Problem Routes (`/api/problems`)

### GET /api/problems

Fetch all problems.

### GET /api/problems/\:id

Fetch problem details by ID.

### POST /api/problems

Create a new problem (requires auth).

**Headers:**

```
x-auth-token: <jwt-token>
```

---

## Submission Routes (`/api/submissions`)

### POST /api/submissions

Submit solution code (requires auth).

### GET /api/submissions/\:id

Get submission details by ID (requires auth).

### GET /api/submissions/user-submissions

Get current user's submissions (requires auth).

---

## Contest Routes (`/api/contests`)

*   **GET /contests**: Get a list of all contests.
*   **GET /contests/:id**: Get details for a specific contest.
*   **GET /contests/:id/standings**: Get the live standings for a contest.
*   **POST /contests**: Create a new contest. (Admin only)
*   **POST /contests/:id/register**: Register the authenticated user for a contest. (Requires auth)
*   **POST /contests/:id/submit**: Submit a solution to a problem within a contest. (Requires auth)
*   **POST /contests/:id/publish**: Make a contest visible to users. (Admin only)

---

## Forum Routes (`/api/forum`)

### Categories (`/api/forum/categories`)

* GET /categories: Get all categories
* GET /categories/\:slug: Get category by slug
* POST /categories: Create a new category (admin only)

### Topics (`/api/forum/topics`)

* GET /topics: Get topics list (supports pagination, filters)
* GET /topics/search: Search topics
* GET /topics/\:slug: Get topic by slug
* POST /topics: Create new topic (requires auth)

### Posts (`/api/forum/posts`)

* GET /posts/topic/\:topicId: Get posts by topic
* POST /posts: Create a post (requires auth)
* POST /posts/\:id/like: Like/unlike a post
* DELETE /posts/\:id: Delete a post (author/admin/mod only)

### Profiles (`/api/forum/profiles`)

* GET /profiles/leaderboard: Get leaderboard
* GET /profiles/\:userId: Get profile by user ID
* PUT /profiles/me: Update current user's profile (requires auth)

### Forum Stats (`/api/forum/stats`)

* GET /stats: Get forum statistics

---

## Error Responses

### 400 Bad Request

```json
{
  "message": "Validation error message"
}
```

### 401 Unauthorized

```json
{
  "message": "No token, authorization denied"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "message": "Permission denied. Admin access required."
}
```

### 404 Not Found

```json
{
  "message": "Resource not found"
}
```

### 429 Too Many Requests

```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again later."
}
```

### 500 Internal Server Error

```json
{
  "message": "Server error"
}
```

---

## Rate Limits

* Create Topic: 5 requests per 15 minutes
* Create Post: 10 requests per minute
* Like Post: 30 requests per minute

---

## Notes

* All dates follow ISO 8601 format
* Default pagination: page=1, limit=20
* JWT tokens expire in 1 hour
* Forum supports Vietnamese slug generation
* Email notifications are sent for forum activities
* Full-text search supported on titles and content
