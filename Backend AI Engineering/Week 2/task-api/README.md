# Task API

A simple RESTful CRUD API built using **Node.js** and **Express.js**. The API manages an in-memory list of tasks and supports creating, reading, updating, and deleting tasks. Interactive API documentation is provided using **Swagger UI**.

> **Note:** This project stores data in memory only. Any tasks created or updated are lost when the server is restarted.

---

## Technologies Used

* Node.js
* Express.js
* Swagger UI Express
* OpenAPI 3.0

---

## Installation

Clone the repository and install the dependencies:

```bash
npm install
```

---

## Running the Server

Start the server using:

```bash
node index.js
```

The server will run at:

```
http://localhost:3000
```

Swagger UI is available at:

```
http://localhost:3000/api-docs
```

---

## API Endpoints

| Method | Endpoint     | Description                      |
| ------ | ------------ | -------------------------------- |
| GET    | `/`          | Returns API information          |
| GET    | `/health`    | Returns the server health status |
| GET    | `/tasks`     | Returns all tasks                |
| GET    | `/tasks/:id` | Returns a single task by ID      |
| POST   | `/tasks`     | Creates a new task               |
| PUT    | `/tasks/:id` | Updates an existing task         |
| DELETE | `/tasks/:id` | Deletes a task                   |

---

## Example Request

Create a new task:

```bash
curl -i -X POST http://localhost:3000/tasks \
-H "Content-Type: application/json" \
-d "{\"title\":\"Buy milk\"}"
```

### Example Response

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{
  "id": 4,
  "title": "Buy milk",
  "done": false
}
```

---

## Swagger UI

Swagger UI provides interactive documentation for all available endpoints. It allows every endpoint to be tested directly from the browser without using curl.

(screenshots/main.png) <br>
(screenshots/s0.png)<br>
(screenshots/s1.png)<br>
(screenshots/s2.png)

---

## Project Structure

```
task-api/
│
├── index.js
├── openapi.json
├── package.json
├── package-lock.json
├── README.md
└── node_modules/
```

---

## Features

* Full CRUD functionality
* In-memory task storage
* Input validation for POST and PUT requests
* Appropriate HTTP status codes
* JSON responses
* Interactive Swagger documentation

---

## HTTP Status Codes Used

| Status Code | Meaning                        |
| ----------- | ------------------------------ |
| 200         | Request completed successfully |
| 201         | Task created successfully      |
| 204         | Task deleted successfully      |
| 400         | Invalid request data           |
| 404         | Task not found                 |

---

## Author

Developed as part of the **Week 2 – Build Your First CRUD API** assignment.