# Research Platform

A full-stack research platform for conducting writing experiments with voice transcription, AI chat assistance, and comprehensive interaction logging.

## Features

- **Voice Transcription**: Record and transcribe audio using OpenAI's transcription API
- **AI Chat Assistant**: Integrated chat interface with OpenAI GPT models
- **Session Management**: Track user sessions and writing progress
- **Interaction Logging**: Comprehensive logging of user interactions, timestamps, and events
- **Final Submissions**: Store and manage final writing submissions with metadata

## Tech Stack

### Backend
- **Node.js** with **TypeScript**
- **Express.js** for REST API
- **Socket.io** for real-time communication
- **MySQL** for data persistence
- **OpenAI API** for transcription and chat

### Frontend
- **React** with **TypeScript**
- **Socket.io Client** for real-time features
- **React Markdown** for rich text rendering

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **MySQL** (v8.0 or higher) - [Download here](https://dev.mysql.com/downloads/mysql/)
- **OpenAI API Key** - [Get one here](https://platform.openai.com/api-keys)

## Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd research-platform
```

### 2. Database Setup

#### Step 1: Start MySQL Server

Make sure your MySQL server is running. You can check by running:

```bash
mysql --version
```

#### Step 2: Create Database

Log into MySQL:

```bash
mysql -u root -p
```

Create the database:

```sql
CREATE DATABASE research_platform;
EXIT;
```

#### Step 3: Run Database Schema

Navigate to the backend directory and run the schema file:

```bash
cd backend
mysql -u root -p research_platform < database/schema.sql
```

This will create all necessary tables:
- `sessions` - User session tracking
- `transcripts` - Voice transcriptions
- `chat_messages` - AI chat history
- `final_writings` - User submissions
- `submissions` - Comprehensive submission data

### 3. Backend Setup

#### Step 1: Install Backend Dependencies

```bash
cd backend
npm install
```

#### Step 2: Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Server Configuration
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=research_platform

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5-mini

# Security (optional)
JWT_SECRET=your_jwt_secret_for_sessions
```

**Important**: Replace the following values:
- `DB_PASSWORD`: Your MySQL root password (or the password for your MySQL user)
- `OPENAI_API_KEY`: Your OpenAI API key from https://platform.openai.com/api-keys
- `JWT_SECRET`: A random string for session security (optional, for future use)

#### Step 3: Build the Backend

```bash
npm run build
```

#### Step 4: Start the Backend Server

For development (with hot reload):

```bash
npm run dev
```

For production:

```bash
npm start
```

The backend server should now be running on `http://localhost:5001`

### 4. Frontend Setup

Open a new terminal window/tab:

#### Step 1: Install Frontend Dependencies

```bash
cd frontend
npm install
```

#### Step 2: Start the Frontend Development Server

```bash
npm start
```

The frontend should automatically open in your browser at `http://localhost:3000`

## Running the Application

Once both servers are running:

1. **Backend**: Running on `http://localhost:5001`
2. **Frontend**: Running on `http://localhost:3000`

You should see the research platform interface in your browser.

## Project Structure

```
research-platform/
├── backend/
│   ├── src/
│   │   ├── index.ts           # Main server entry point
│   │   ├── config/            # Configuration files
│   │   ├── routes/            # API routes
│   │   ├── controllers/       # Request handlers
│   │   └── services/          # Business logic
│   ├── database/
│   │   ├── schema.sql         # Database schema
│   │   └── migrate_*.sql      # Migration scripts
│   ├── dist/                  # Compiled TypeScript output
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                   # Environment variables (create this)
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Main React component
│   │   ├── components/        # React components
│   │   └── services/          # API and WebSocket services
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## Available Scripts

### Backend Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server (requires build first)

### Frontend Scripts

- `npm start` - Start development server
- `npm run build` - Create production build
- `npm test` - Run tests

## Troubleshooting

### MySQL Connection Issues

If you get a MySQL connection error:

1. **Check MySQL is running**:
   ```bash
   mysql -u root -p
   ```

2. **Verify database exists**:
   ```sql
   SHOW DATABASES;
   ```

3. **Check credentials in `.env`**: Make sure `DB_USER`, `DB_PASSWORD`, and `DB_NAME` are correct

4. **Grant permissions** (if needed):
   ```sql
   GRANT ALL PRIVILEGES ON research_platform.* TO 'root'@'localhost';
   FLUSH PRIVILEGES;
   ```

### Port Already in Use

If port 5001 or 3000 is already in use:

**Backend**: Change `PORT` in `backend/.env`

**Frontend**: Set `PORT` environment variable:
```bash
PORT=3001 npm start
```

### OpenAI API Issues

If you get OpenAI API errors:

1. **Verify API key**: Check your key at https://platform.openai.com/api-keys
2. **Check billing**: Ensure your OpenAI account has available credits
3. **Model availability**: Verify the model name in `.env` (e.g., `gpt-4o-mini`)

### TypeScript Compilation Errors

If you encounter TypeScript errors:

```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

## Database Migrations

If you need to apply database migrations after updates:

```bash
cd backend
mysql -u root -p research_platform < database/migrate_<migration_name>.sql
```

Available migrations in `backend/database/`:
- `migrate_add_timestamps.sql`
- `migrate_timestamp_to_bigint.sql`
- `migrate_expand_submission_columns.sql`
- `migrate_add_interaction_logs_url.sql`
- `migrate_add_selection_event_type.sql`
- `migrate_add_regenerate_menu_section.sql`

## Additional Documentation

For more detailed information about the platform:

- `PLATFORM_OVERVIEW.md` - High-level platform architecture
- `INTERACTION_LOGGING_GUIDE.md` - Detailed interaction logging system
- `LOGGING_ARCHITECTURE.md` - Logging system architecture
- `TIMESTAMP_SCHEMA.md` - Timestamp tracking documentation

## Development Tips

1. **Keep both terminals open**: One for backend (`npm run dev`), one for frontend (`npm start`)
2. **Check logs**: Backend logs will show API requests and database queries
3. **Browser DevTools**: Use console to see frontend logs and WebSocket messages
4. **Database GUI**: Consider using MySQL Workbench or DBeaver for easier database management

## License

[Add your license here]

## Support

For issues or questions, please [create an issue](link-to-issues) or contact the development team.
