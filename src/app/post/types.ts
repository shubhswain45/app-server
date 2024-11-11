export const types = `#graphql
# Input type for creating a new post
input createPostData {
    content: String
    imgURL: String!
}

# Post type
type Post {
    id: ID!
    content: String
    imgURL: String!

    author: User
    _count: PostCount  # Contains count of likes
    hasLiked: Boolean  # Indicates if the current user has liked the post
}

# PostCount type to hold like count
type PostCount {
    likes: Int  # Number of likes on the post
}
`