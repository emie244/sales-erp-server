import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded, static as serveStatic, Request, Response, NextFunction } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use('/uploads', serveStatic(join(process.cwd(), 'uploads')));
  app.setGlobalPrefix('api/v1');

  const distPath = join(process.cwd(), 'web', 'dist');
  app.use(serveStatic(distPath));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(join(distPath, 'index.html'), {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
