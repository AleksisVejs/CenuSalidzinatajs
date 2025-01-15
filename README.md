# CenuSalidzinatajs

A web application that scrapes product prices from various websites. The project consists of a Node.js backend server and a Vue.js frontend application.

## Project Structure

```
price-scraper/
├── frontend/         # Vue.js frontend application
├── server.js         # Express.js backend server
├── package.json      # Backend dependencies
└── .env             # Environment variables
```

## Prerequisites

Before running this project, make sure you have the following installed:
- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

### Backend Setup

1. Clone the repository and navigate to the project root:
```bash
git clone https://github.com/AleksisVejs/CenuSalidzinatajs
cd price-scraper
```

2. Install backend dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add necessary environment variables:
```
PORT=3000
# Add other environment variables as needed
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install frontend dependencies:
```bash
npm install
```

## Running the Application

### Start the Backend Server

1. From the project root directory:
```bash
npm start
```
The server will start on http://localhost:3000 (or the port specified in your .env file)

### Start the Frontend Development Server

1. In a new terminal, navigate to the frontend directory:
```bash
cd frontend
```

2. Start the Vue.js development server:
```bash
npm run serve
```
The frontend will be available at http://localhost:8080

## Technologies Used

### Backend
- Node.js
- Express.js
- Puppeteer (for web scraping)
- Cheerio
- Axios
- Cors
- Dotenv

### Frontend
- Vue.js 3
- Core-js
- Fuse.js

## Building for Production

To build the frontend for production:

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Run the build command:
```bash
npm run build
```

The production-ready files will be generated in the `frontend/dist` directory. 