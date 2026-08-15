const mongoose = require("mongoose");

const documentImageSchema = new mongoose.Schema(
    {
        front: {
            type: String,
            required: true,
            trim: true,
            select: false,
        },

        back: {
            type: String,
            required: true,
            trim: true,
            select: false,
        },

        verified: {
            type: Boolean,
            default: false,
        },

        verifiedAt: {
            type: Date,
            default: null,
        },

        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SuperAdmin",
            default: null,
        },
    },
    {
        _id: false,
    }
);

const driverApplicationSchema = new mongoose.Schema(
    {
        fullname: {
            firstname: {
                type: String,
                required: true,
                trim: true,
                minlength: 3,
            },

            lastname: {
                type: String,
                default: "",
                trim: true,
            },
        },

        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
            select: false,
        },

        identification: {
            number: {
                type: String,
                required: true,
                trim: true,
            },

            type: {
                type: String,
                enum: ["CC", "CE", "PASSPORT", "OTHER"],
                default: "CC",
            },
        },

        vehicle: {
            color: {
                type: String,
                required: true,
                trim: true,
            },

            plate: {
                type: String,
                required: true,
                uppercase: true,
                trim: true,
            },

            brand: {
                type: String,
                default: "",
                trim: true,
            },

            reference: {
                type: String,
                default: "",
                trim: true,
            },

            model: {
                type: String,
                default: "",
                trim: true,
            },

            capacity: {
                type: Number,
                required: true,
                min: 1,
            },

            capacityUnit: {
                type: String,
                enum: ["kg", "ton"],
                default: "kg",
            },

            capacityKg: {
                type: Number,
                required: true,
                min: 1,
            },

            vehicleType: {
                type: String,
                required: true,
                enum: [
                    "motorcycle",
                    "car",
                    "motocarro",
                    "pickup",
                    "van",
                    "light_truck",
                    "medium_truck",
                    "heavy_truck",
                    "simple_truck",
                    "double_troque",
                    "dump_truck",
                    "mini_trailer",
                    "tractor_trailer",
                    "lowboy",
                    "special_vehicle",
                ],
            },

            bodyType: {
                type: String,
                enum: [
                    "not_specified",
                    "closed_van",
                    "stakes",
                    "platform",
                    "refrigerated",
                    "dump",
                    "tank",
                    "container_carrier",
                    "lowboy",
                    "open_body",
                    "other",
                ],
                default: "not_specified",
            },

            axleCount: {
                type: Number,
                min: 1,
                default: null,
            },

            photo: {
                type: String,
                default: "",
                trim: true,
                select: false,
            },
        },

        documents: {
            identificationCard: {
                type: documentImageSchema,
                required: true,
            },

            drivingLicense: {
                type: documentImageSchema,
                required: true,
            },

            vehicleRegistration: {
                type: documentImageSchema,
                required: true,
            },

            /*
             * Campos antiguos conservados temporalmente.
             *
             * No son obligatorios y permiten mantener compatibilidad
             * mientras se actualiza el panel administrativo anterior.
             */
            drivingLicenseImage: {
                type: String,
                default: "",
                trim: true,
                select: false,
            },

            vehicleRegistrationImage: {
                type: String,
                default: "",
                trim: true,
                select: false,
            },
        },

        securityConsent: {
            accepted: {
                type: Boolean,
                default: false,
            },

            acceptedAt: {
                type: Date,
                default: null,
            },

            privacyPolicyVersion: {
                type: String,
                default: "",
                trim: true,
            },

            ipAddress: {
                type: String,
                default: "",
                trim: true,
                select: false,
            },

            userAgent: {
                type: String,
                default: "",
                trim: true,
                select: false,
            },
        },

        status: {
            type: String,
            enum: [
                "pending",
                "approved",
                "rejected",
                "needs_changes",
            ],
            default: "pending",
        },

        rejectionReason: {
            type: String,
            default: "",
            trim: true,
        },

        reviewNotes: {
            type: String,
            default: "",
            trim: true,
        },

        reviewedAt: {
            type: Date,
            default: null,
        },

        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SuperAdmin",
            default: null,
        },

        approvedCaptainId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "captain",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

driverApplicationSchema.pre("validate", function (next) {
    if (!this.vehicle) {
        next();
        return;
    }

    const capacity = Number(this.vehicle.capacity);
    const unit = this.vehicle.capacityUnit || "kg";

    if (Number.isFinite(capacity) && capacity > 0) {
        this.vehicle.capacityKg =
            unit === "ton"
                ? capacity * 1000
                : capacity;
    }

    next();
});

driverApplicationSchema.pre("save", function (next) {
    if (!this.documents) {
        next();
        return;
    }

    /*
     * Copias temporales para no romper el panel administrativo
     * que todavía pueda leer los nombres antiguos.
     */
    if (
        this.documents.drivingLicense?.front &&
        !this.documents.drivingLicenseImage
    ) {
        this.documents.drivingLicenseImage =
            this.documents.drivingLicense.front;
    }

    if (
        this.documents.vehicleRegistration?.front &&
        !this.documents.vehicleRegistrationImage
    ) {
        this.documents.vehicleRegistrationImage =
            this.documents.vehicleRegistration.front;
    }

    next();
});

driverApplicationSchema.index({
    email: 1,
    status: 1,
});

driverApplicationSchema.index({
    "vehicle.plate": 1,
    status: 1,
});

driverApplicationSchema.index({
    "identification.number": 1,
    status: 1,
});

driverApplicationSchema.index({
    "vehicle.vehicleType": 1,
    status: 1,
});

driverApplicationSchema.index({
    "vehicle.capacityKg": 1,
    status: 1,
});

module.exports = mongoose.model(
    "DriverApplication",
    driverApplicationSchema
);