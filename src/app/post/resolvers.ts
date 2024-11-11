import { Post } from "@prisma/client";
import { prismaClient } from "../../clients/db";
import { GraphqlContext } from "../../interfaces";
import { v2 as cloudinary } from 'cloudinary';

interface CreatePostPayload {
    content?: string
    imgURL: string
}

const queries = {
    getFeedPosts: async (parent: any, args: any, ctx: GraphqlContext) => {
        if (!ctx.user?.id) {
            return null;  // Return null if the user is not authenticated
        }
    
        // Fetch the first 5 posts from the database along with likes
        const posts = await prismaClient.post.findMany({
            take: 5,  // Limit to 5 posts
            include: {
                likes: {
                    where: {
                        userId: ctx.user.id,  // Only include likes by the current user
                    }
                },
            }
        });
    
        // Map over posts to add the count of likes and hasLiked flag
        const postsWithHasLiked = posts.map(post => {
            // Count the total likes for each post
            const likeCount = post.likes.length;  // This gives us the number of likes
            const hasLiked = likeCount > 0;  // If the user has liked this post, set hasLiked to true
    
            return {
                ...post,
                likeCount,  // Add the like count to the post
                hasLiked,   // Add the hasLiked flag
                likes: undefined,  // Optionally remove likes from the response to avoid duplication
            };
        });
    
        return postsWithHasLiked;
    }
    
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

        // Validate the image URL before uploading (you can add additional validation here if necessary)
        if (!imgURL) throw new Error("Image URL is required");

        try {
            // Upload image to Cloudinary
            const uploadResult = await cloudinary.uploader.upload(imgURL, {
                // You can add more options like transformation, tags, etc.
            });

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
        try {
            // Ensure the user is authenticated
            if (!ctx.user) throw new Error("Please Login/Signup first!");

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
            return false;

        } catch (error: any) {
            // If the like doesn't exist, handle the error and create the like (like the post)
            if (error.code === 'P2025') { // This error code indicates that the record was not found
                if (!ctx.user) throw new Error("User must be authenticated to like a post!");

                // Create a like entry (Prisma will automatically link the user and post)
                await prismaClient.like.create({
                    data: {
                        userId: ctx.user.id,  // User ID from the context
                        postId,  // Post ID to associate the like with
                    }
                });
                return true;
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

export const resolvers = { queries, mutations, extraResolvers }