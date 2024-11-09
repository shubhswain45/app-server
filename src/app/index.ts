import express, { Request, Response } from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import bodyParser from 'body-parser';
import { Auth } from './auth';
import cors from 'cors';
import { GraphqlContext } from '../interfaces';
import JWTService from '../services/JWTService';

export async function initServer() {
    const app = express();

    app.use(bodyParser.json({ limit: '10mb' }));

    // CORS configuration
    const corsOptions = {
        origin: ['http://localhost:3000'],
        credentials: true,
    };

    // Use CORS middleware
    app.use(cors(corsOptions));

    const graphqlServer = new ApolloServer<GraphqlContext>({
        typeDefs: `
            ${Auth.types}

            type Query {
                ${Auth.queries}
            }

            type Mutation {
                ${Auth.mutations}
            }
        `,
        resolvers: {
            Query: {
                ...Auth.resolvers.queries,
            },
            Mutation: {
                ...Auth.resolvers.mutations,
            },
        },
    });

    await graphqlServer.start();

    app.use(
        '/graphql',
        expressMiddleware(graphqlServer, {
            context: async ({ req, res }: { req: Request; res: Response }): Promise<GraphqlContext> => {
                return {
                    user: req.headers.authorization ? JWTService.decodeToken(req.headers.authorization) : undefined,
                };
            },
        })
    );

    return app;
}
