import axios from 'axios'
import { prismaClient } from '../../clients/db';
import JWTService from '../../services/JWTService';
import { GraphqlContext, JWTUser } from '../../interfaces';

interface GoogleJwtPayload {
    iss: string;
    azp: string;
    aud: string;
    sub: string;
    email: string;
    email_verified: string; // Consider converting to `boolean` if consistently boolean
    nbf: string;
    name: string;
    picture: string;
    given_name: string;
    family_name: string;
    iat: string;
    exp: string;
    jti: string;
    alg: string;
    kid: string;
    typ: string;
}

const queries = {
    getCurrentUser: async (parent: any, args: any, ctx: GraphqlContext) => {
        try {
            const id = ctx.user?.id;
            if (!id) return null;

            const user = await prismaClient.user.findUnique({ where: { id } });
            return user;
        } catch (error) {
            return null;
        }
    }
};

const mutations = {
    loginWithGoogle: async (parent: any, { token }: { token: string }, ctx: GraphqlContext) => {
        try {
            const googleOauthURL = new URL("https://oauth2.googleapis.com/tokeninfo");
            googleOauthURL.searchParams.set('id_token', token);

            const { data } = await axios.get<GoogleJwtPayload>(googleOauthURL.toString(), {
                responseType: 'json'
            });

            console.log("data", data);

            // Check if the email is verified
            if (data.email_verified !== "true") {
                throw new Error("Email not verified by Google.");
            }

            let user = await prismaClient.user.findUnique({ where: { email: data.email } });

            const fullName = data.family_name ? `${data.given_name} ${data.family_name}` : data.given_name;

            if (!user) {
                user = await prismaClient.user.create({
                    data: {
                        username: data.email.split("@")[0],
                        fullName,
                        email: data.email,
                        profileImageURL: data.picture,
                        isVerified: true,
                    }
                });
            }

            const payload = {
                id: user.id,
                username: user.username
            } as JWTUser

            const userToken = JWTService.generateTokenForUser(payload);

            return userToken;
        } catch (error: any) {
            console.log(error, "error");

            throw new Error(error?.message || "Failed to authenticate with Google.");
        }
    },

};

export const resolvers = {queries, mutations }