import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { GraphqlContext } from '../interfaces';
import JWTService from '../services/JWTService';
import { Auth } from './auth';
import { Post } from './post';
import bodyParser from 'body-parser';

export async function initServer() {
    const app = express();

    // Middleware to parse cookies
    app.use(cookieParser());

    // CORS configuration
    const corsOptions = {
        origin: ['http://localhost:3000'], // your frontend URL
        credentials: true, // Ensure cookies are sent with cross-origin requests
    };

    // Use CORS middleware
    app.use(cors(corsOptions));
    app.use(bodyParser.json({limit: "10mb"}))

    const graphqlServer = new ApolloServer<GraphqlContext>({
        typeDefs: `
            ${Auth.types}
            ${Post.types}

            type Query {
                ${Auth.queries}
                ${Post.queries}
            }

            type Mutation {
                ${Auth.mutations}
                ${Post.mutations}
            }
        `,
        resolvers: {
            Query: {
                ...Auth.resolvers.queries,
                ...Post.resolvers.queries,
            },
            Mutation: {
                ...Auth.resolvers.mutations,
                ...Post.resolvers.mutations,
            },
            ...Post.resolvers.extraResolvers,
        },
    });

    await graphqlServer.start();

    // GraphQL Middleware
    app.use(
        '/graphql',
        expressMiddleware(graphqlServer, {
            context: async ({ req, res }: { req: Request; res: Response }): Promise<GraphqlContext> => {
                let token;
    
                // First, check if the cookie '__moments_token' is available
                if (req.cookies["__moments_token"]) {
                    token = req.cookies["__moments_token"];
                    console.log("Token from cookie:", token);
                }
                // If the cookie is not available, check the Authorization header
                else {
                    const authHeader = req.headers.authorization;
                    if (authHeader && authHeader.startsWith('Bearer ')) {
                        token = authHeader.split('Bearer ')[1]; // Extract token from Authorization header
                        console.log("Token from Authorization header:", token);
                    }
                }
    
                let user;
                if (token) {
                    try {
                        user = JWTService.decodeToken(token);
                        console.log("Decoded user:", user);
                    } catch (error) {
                        console.error('Error decoding token:', error);
                    }
                }
    
                return {
                    user,
                    req,
                    res,
                };
            },
        })
    );
    

    return app;
}
