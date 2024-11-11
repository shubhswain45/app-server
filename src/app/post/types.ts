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
    totalLikeCount: Int!  # Like count for the post
    hasLiked: Boolean!    # Whether the authenticated user has liked the post
}
`
