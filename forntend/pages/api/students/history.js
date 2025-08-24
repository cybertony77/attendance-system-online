import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

// Load environment variables from env.config
function loadEnvConfig() {
  try {
    const envPath = path.join(process.cwd(), '..', 'env.config');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim();
          let value = trimmed.substring(index + 1).trim();
          value = value.replace(/^"|"$/g, ''); // strip quotes
          envVars[key] = value;
        }
      }
    });
    
    return envVars;
  } catch (error) {
    console.log('⚠️  Could not read env.config, using process.env as fallback');
    return {};
  }
}

const envConfig = loadEnvConfig();
const JWT_SECRET = envConfig.JWT_SECRET || process.env.JWT_SECRET || 'topphysics_secret';
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'topphysics';

console.log('🔗 Using Mongo URI:', MONGO_URI);

async function authMiddleware(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    throw new Error('Unauthorized - No Bearer token');
  }
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Invalid token - ' + error.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication
    const user = await authMiddleware(req);
    
    // Get history data
    const historyRecords = await db.collection('history').find().toArray();
    
    // Get current student data to include updated student info
    const currentStudents = await db.collection('students').find().toArray();
    const studentMap = new Map();
    
    // Create a map of current student data by ID
    const currentStudentMap = new Map();
    currentStudents.forEach(student => {
      currentStudentMap.set(student.id, student);
    });
    
    historyRecords.forEach(record => {
      if (!studentMap.has(record.studentId)) {
        const currentStudent = currentStudentMap.get(record.studentId);
        if (currentStudent) {
          studentMap.set(record.studentId, {
            id: record.studentId,
            name: currentStudent.name,
            grade: currentStudent.grade,
            school: currentStudent.school,
            phone: currentStudent.phone,
            parentsPhone: currentStudent.parentsPhone,
            historyRecords: []
          });
        }
      }
      studentMap.get(record.studentId).historyRecords.push(record);
    });
    
    // Convert map to array and sort by ID
    const result = Array.from(studentMap.values()).sort((a, b) => a.id - b.id);
    
    res.json(result);
  } catch (error) {
    if (error.message.includes('Unauthorized') || error.message.includes('Invalid token')) {
      res.status(401).json({ error: error.message });
    } else {
      console.error('Error fetching history data:', error);
      res.status(500).json({ error: 'Failed to fetch history data' });
    }
  } finally {
    if (client) await client.close();
  }
} 