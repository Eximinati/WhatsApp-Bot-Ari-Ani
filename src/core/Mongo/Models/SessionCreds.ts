import { Schema, model } from 'mongoose'

const SessionCredsSchema = new Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    creds: {
        type: String,
        default: ""
    },
    encryptionKey: {
        type: String,
        default: ""
    }
}, {
    timestamps: true,
    collection: "session_creds"
})

export default model('SessionCreds', SessionCredsSchema)