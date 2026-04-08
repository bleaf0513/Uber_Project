const getFare = async (pickup, destination) => {
    if (!pickup || !destination) {
        throw new Error("pickup and destination are required");
    }

    const distanceTime = await mapService.getDistance(pickup, destination);
    const meters = distanceTime?.distance?.value;
    const seconds = distanceTime?.duration?.value;

    if (!Number.isFinite(meters) || !Number.isFinite(seconds)) {
        throw new Error("Could not compute fare for this route");
    }

    const distanceKm = meters / 1000;
    const durationMin = seconds / 60;

    const baseFare = {
        car: 3500,
        moto: 2200,
        auto: 2800,
    };

    const perKmRate = {
        car: 1200,
        moto: 700,
        auto: 900,
    };

    const perMinuteRate = {
        car: 180,
        moto: 100,
        auto: 130,
    };

    const minimumFare = {
        car: 5500,
        moto: 3000,
        auto: 4000,
    };

    const fares = {
        car: Math.round(
            baseFare.car +
            perKmRate.car * distanceKm +
            perMinuteRate.car * durationMin
        ),
        moto: Math.round(
            baseFare.moto +
            perKmRate.moto * distanceKm +
            perMinuteRate.moto * durationMin
        ),
        auto: Math.round(
            baseFare.auto +
            perKmRate.auto * distanceKm +
            perMinuteRate.auto * durationMin
        ),
    };

    return {
        car: Math.max(fares.car, minimumFare.car),
        moto: Math.max(fares.moto, minimumFare.moto),
        auto: Math.max(fares.auto, minimumFare.auto),
    };
};
