const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const superAdminSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
            select: false,
        },

        role: {
            type: String,
            enum: ['super_admin', 'support_admin', 'finance_admin'],
            default: 'super_admin',
        },

        active: {
            type: Boolean,
            default: true,
        },

        lastLoginAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

superAdminSchema.methods.generateAuthToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            id: this._id,
            email: this.email,
            role: this.role,
            type: 'super_admin',
        },
        process.env.JWT_SECRET,
        {
            expiresIn: '7d',
        }
    );
};

superAdminSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

superAdminSchema.statics.hashPassword = async function (password) {
    return bcrypt.hash(password, 10);
};

const SuperAdmin = mongoose.models.SuperAdmin || mongoose.model('SuperAdmin', superAdminSchema);

module.exports = SuperAdmin;