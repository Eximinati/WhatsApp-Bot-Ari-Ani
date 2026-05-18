import { Schema, model } from 'mongoose'

const SessionSchema = new Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    session: {
        type: String,
        default: "",
        index: { sparse: true, unique: true }
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
    timestamps: true
})

export default model('Session', SessionSchema)
