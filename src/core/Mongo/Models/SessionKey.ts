import { Schema, model } from 'mongoose'

const SessionKeySchema = new Schema({
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    category: {
        type: String,
        required: true,
        index: true
    },
    keyId: {
        type: String,
        required: true
    },
    value: {
        type: String,
        default: ""
    }
}, {
    timestamps: true,
    collection: "session_keys"
})

SessionKeySchema.index({ sessionId: 1, category: 1, keyId: 1 }, { unique: true })

export default model("SessionKey", SessionKeySchema)