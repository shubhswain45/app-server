export const types = `#graphql
    input createPostData {
        content: String
        imgURL: String!
    }

    type Post {
        id: ID!
        content: String
        imgURL: String!

        author: User
    }
`