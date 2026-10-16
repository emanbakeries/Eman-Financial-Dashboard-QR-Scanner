import express from 'express';
import cookieParser from 'cookie-parser';
import { apiRouter } from '../server/api.ts';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Mount the exact same API router used in local & container mode
app.use('/api', apiRouter);

export default app;
