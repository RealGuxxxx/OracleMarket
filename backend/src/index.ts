import express from 'express';
import cors from 'cors';
import { config } from './config';
import routes from './routes';

const app = express();

app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

const originalJson = express.json();
app.use((req, res, next) => {
  originalJson(req, res, () => {
    const originalJsonMethod = res.json.bind(res);
    res.json = function (data: any) {
      const convertBigInt = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'bigint') return obj.toString();
        if (Array.isArray(obj)) return obj.map(convertBigInt);
        if (typeof obj === 'object') {
          const converted: any = {};
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              converted[key] = convertBigInt(obj[key]);
            }
          }
          return converted;
        }
        return obj;
      };
      return originalJsonMethod(convertBigInt(data));
    };
    next();
  });
});

app.use(express.urlencoded({ extended: true }));
app.use('/api/v1', routes);

app.get('/', (req, res) => {
  res.json({
    message: 'Oracle Marketplace Backend API',
    version: '1.0.0',
    endpoints: '/api/v1',
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

const PORT = config.port;
app.listen(PORT, () => {
  // Server started successfully
});

process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});
