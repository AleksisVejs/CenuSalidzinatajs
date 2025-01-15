# CenuSalidzinatajs

A web application that scrapes product prices from various websites. The project consists of a Node.js backend server and a Vue.js frontend application.

## Contents
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Running the Application](#running-the-application)
  - [Start the Backend Server](#start-the-backend-server)
  - [Start the Frontend Development Server](#start-the-frontend-development-server)
- [Technologies Used](#technologies-used)
- [Building for Production](#building-for-production)
- [How It Works](#how-it-works)

## Project Structure

```
CenuSalidzinatajs/
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
cd CenuSalidzinatajs
```

2. Install backend dependencies:
```bash
npm install
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
node server.js
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

## How It Works

The CenuSalidzinatajs (Price Comparator) works through the following process:

1. **User Input**: Users can search for products through the Vue.js frontend interface.

2. **Backend Processing**:
   - The Express.js server receives search requests from the frontend
   - Using Puppeteer and Cheerio, it scrapes product information from multiple e-commerce websites
   - The data is processed and standardized to ensure consistent formatting

3. **Price Comparison**:
   - Products are matched across different websites using Fuse.js for fuzzy matching
   - Prices are compared and sorted to show the best deals
   - Additional information like product availability and shipping costs are included when available

4. **Results Display**:
   - The frontend receives the processed data and displays it in an easy-to-read format
   - Users can sort results by price, store, or other criteria
   - Each product listing includes direct links to the source websites

The application updates prices in real-time when users perform searches, ensuring they always see the most current pricing information. 