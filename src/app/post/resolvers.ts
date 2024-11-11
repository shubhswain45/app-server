import { Post } from "@prisma/client";
import { prismaClient } from "../../clients/db";
import { GraphqlContext } from "../../interfaces";
import { v2 as cloudinary } from 'cloudinary';

interface CreatePostPayload {
    content?: string;
    imgURL: string;
}

// Define the type for the Like model
type Like = {
    userId: string;
};

// Define the type for the Post model including _count and likes
type PostWithCount = {
    id: string;
    content: string | null;
    imgURL: string;
    authorId: string;
    createdAt: Date; // Include createdAt
    updatedAt: Date; // Include updatedAt
    _count: {
        likes: number; // Count of likes
    };
    likes: Like[]; // Array of likes
};

// Define the return type for the response of getFeedPosts
type FeedPostResponse = {
    id: string;
    content: string | null;
    imgURL: string;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
    totalLikeCount: number; // Total number of likes
    userHasLiked: boolean; // Whether the current user has liked the post
};

const queries = {
    getFeedPosts: async (parent: any, args: any, ctx: GraphqlContext): Promise<FeedPostResponse[] | null> => {
        // Check if the user is authenticated
        if (!ctx.user?.id) {
            return null; // Return null if the user is not authenticated
        }

        // Fetch the first 5 posts from the database along with the count of likes
        const posts = await prismaClient.post.findMany({
            take: 5,
            include: {
                _count: { select: { likes: true } }, // Include the count of likes
                likes: {
                    where: { userId: ctx.user.id }, // Only retrieve likes by the current user
                    select: { userId: true },
                },
            },
        }) as PostWithCount[]; // Cast to your custom type

        // Log the fetched posts for debugging
        console.log(posts);
        
        // Map the posts to include totalLikeCount and userHasLiked properties
        return posts.map(post => ({
            ...post,
            totalLikeCount: post._count.likes,
            userHasLiked: post.likes.length > 0,
        }));
    },
};

const mutations = {
    createPost: async (
        parent: any,
        { payload }: { payload: CreatePostPayload },
        ctx: GraphqlContext
    ) => {
        // Ensure the user is authenticated
        if (!ctx.user) throw new Error("Please Login/Signup first!");

        const { imgURL, content } = payload;

        // Validate the image URL before uploading
        if (!imgURL) throw new Error("Image URL is required");

        try {
            // Upload image to Cloudinary
            const uploadResult = await cloudinary.uploader.upload(imgURL);

            // Create post in the database
            const post = await prismaClient.post.create({
                data: {
                    content,
                    imgURL: uploadResult.secure_url, // Store the Cloudinary URL
                    author: { connect: { id: ctx.user.id } } // Associate post with authenticated user
                }
            });

            return post; // Return the created post
        } catch (error) {
            // Handle errors gracefully (Cloudinary or Prisma issues)
            console.error("Error creating post:", error);
            throw new Error("Failed to create post. Please try again.");
        }
    },

    likePost: async (parent: any, { postId }: { postId: string }, ctx: GraphqlContext) => {
        // Ensure the user is authenticated
        if (!ctx.user) throw new Error("Please Login/Signup first!");

        try {
            // Attempt to delete the like (unlike the post)
            await prismaClient.like.delete({
                where: {
                    userId_postId: {
                        userId: ctx.user.id,  // User ID from the context
                        postId,
                    }
                }
            });

            // If successful, return a response indicating the post was unliked
            return false; // Post was unliked

        } catch (error: any) {
            // If the like doesn't exist, handle the error and create the like (like the post)
            if (error.code === 'P2025') { // This error code indicates that the record was not found
                // Create a like entry (Prisma will automatically link the user and post)
                await prismaClient.like.create({
                    data: {
                        userId: ctx.user.id,  // User ID from the context
                        postId,  // Post ID to associate the like with
                    }
                });
                return true; // Post was liked
            }

            // Handle any other errors
            console.error("Error toggling like:", error);
            throw new Error(error.message || "An error occurred while toggling the like on the post.");
        }
    }
};

const extraResolvers = {
    Post: {
        author: async (parent: Post) => await prismaClient.user.findUnique({ where: { id: parent.authorId } })
    }
}

export const resolvers = { queries, mutations, extraResolvers };