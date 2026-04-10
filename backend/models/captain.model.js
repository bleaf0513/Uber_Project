const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const captainSchema = new mongoose.Schema(
    {
        fullname: {
            firstname: {
                type: String,
                required: true,
                minlength: [3, 'First name must be at least 3 characters long'],
                trim: true,
            },
            lastname: {
                type: String,
                minlength: [3, 'Last name must be at least 3 characters long'],
                trim: true,
            },
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: [/\S+@\S+\.\S+/, 'Please enter a valid email'],
            minlength: [6, 'Email must be at least 6 characters long'],
        },
        password: {
            type: String,
            required: true,
        },
        socketId: {
            type: String,
            default: null,
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
        },
        vehicle: {
            color: {
                type: String,
                required: true,
                minlength: [3, 'Color must be at least 3 characters long'],
                trim: true,
            },
            plate: {
                type: String,
                required: true,
                minlength: [3, 'Plate must be at least 3 characters long'],
                uppercase: true,
                trim: true,
            },
            capacity: {
                type: Number,
                required: true,
                min: [1, 'Capacity must be at least 1'],
            },
            vehicleType: {
                type: String,
                required: true,
                enum: [
                    'motorcycle',
                    'car',
                    'light_cargo',
                    'van',
                    'truck',
                ],
            },
        },
        location: {
            ltd: {
                type: Number,
                default: null,
            },
            lng: {
                type: Number,
                default: null,
            },
        },
    },
    {
        timestamps: true,
    }
);

captainSchema.methods.generateAuthToken = function () {
    const token = jwt.sign(
        { _id: this._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
    return token;
};

captainSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

captainSchema.statics.hashPassword = async function (password) {
    return await bcrypt.hash(password, 10);
};

const captainModel = mongoose.model('captain', captainSchema);

module.exports = captainModel;
