package co.com.mercalan.centralgo;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;

import org.json.JSONObject;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class LocationForegroundService extends Service {

    private static final String TAG = "LocationFGService";
    private static final String CHANNEL_ID = "central_go_location_channel";
    private static final int NOTIFICATION_ID = 7001;

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private OkHttpClient httpClient;

    private String driverId = "";
    private String token = "";
    private String apiBaseUrl = "";

    private double lastLat = 0;
    private double lastLng = 0;
    private long lastSentAt = 0L;

    private boolean locationUpdatesStarted = false;

    @Override
    public void onCreate() {
        super.onCreate();

        Log.d(TAG, "onCreate ejecutado");

        createNotificationChannel();

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        httpClient = new OkHttpClient.Builder()
                .connectTimeout(20, TimeUnit.SECONDS)
                .readTimeout(20, TimeUnit.SECONDS)
                .writeTimeout(20, TimeUnit.SECONDS)
                .build();

        Notification notification = buildNotification("Ubicación activa en segundo plano");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        Log.d(TAG, "Servicio foreground iniciado");
    }

    @Override
    public int onStartCommand(android.content.Intent intent, int flags, int startId) {
        Log.d(TAG, "onStartCommand ejecutado");

        if (intent != null) {
            driverId = safe(intent.getStringExtra("driverId"));
            token = safe(intent.getStringExtra("token"));
            apiBaseUrl = safe(intent.getStringExtra("apiBaseUrl"));
        }

        Log.d(TAG, "driverId: " + driverId);
        Log.d(TAG, "token presente: " + (!token.isEmpty()));
        Log.d(TAG, "apiBaseUrl: " + apiBaseUrl);

        if (driverId.isEmpty() || token.isEmpty() || apiBaseUrl.isEmpty()) {
            Log.e(TAG, "Faltan datos para iniciar tracking nativo");
            stopSelf();
            return START_NOT_STICKY;
        }

        startLocationUpdates();

        return START_REDELIVER_INTENT;
    }

    private void startLocationUpdates() {
        if (locationUpdatesStarted) {
            Log.d(TAG, "Las actualizaciones de ubicación ya estaban activas");
            return;
        }

        if (!hasLocationPermission()) {
            Log.e(TAG, "Sin permisos de ubicación");
            stopSelf();
            return;
        }

        locationUpdatesStarted = true;

        Log.d(TAG, "Iniciando actualizaciones de ubicación nativas");

        LocationRequest locationRequest = new LocationRequest.Builder(20000)
                .setMinUpdateIntervalMillis(15000)
                .setMaxUpdateDelayMillis(25000)
                .setWaitForAccurateLocation(false)
                .setPriority(LocationRequest.PRIORITY_HIGH_ACCURACY)
                .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(@NonNull LocationResult locationResult) {
                Location location = locationResult.getLastLocation();

                if (location == null) {
                    Log.w(TAG, "LocationResult llegó sin ubicación");
                    return;
                }

                handleLocation(location, "callback");
            }
        };

        try {
            fusedLocationClient.requestLocationUpdates(
                    locationRequest,
                    locationCallback,
                    getMainLooper()
            );

            Log.d(TAG, "requestLocationUpdates registrado correctamente");

            fusedLocationClient.getLastLocation()
                    .addOnSuccessListener(location -> {
                        if (location != null) {
                            handleLocation(location, "lastLocation");
                        } else {
                            Log.w(TAG, "getLastLocation no devolvió ubicación");
                        }
                    })
                    .addOnFailureListener(error -> {
                        Log.e(TAG, "Error obteniendo getLastLocation", error);
                    });

        } catch (SecurityException error) {
            Log.e(TAG, "SecurityException iniciando ubicación", error);
            stopSelf();
        } catch (Exception error) {
            Log.e(TAG, "Error general iniciando ubicación", error);
            stopSelf();
        }
    }

    private void handleLocation(Location location, String source) {
        double lat = location.getLatitude();
        double lng = location.getLongitude();
        float accuracy = location.getAccuracy();

        Log.d(
                TAG,
                "Ubicación recibida [" + source + "]: " + lat + ", " + lng + " acc=" + accuracy
        );

        if (shouldSkip(lat, lng)) {
            Log.d(TAG, "Ubicación omitida por poca distancia/tiempo");
            return;
        }

        sendLocationToBackend(lat, lng);
    }

    private boolean hasLocationPermission() {
        boolean fineGranted =
                ActivityCompat.checkSelfPermission(
                        this,
                        Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED;

        boolean coarseGranted =
                ActivityCompat.checkSelfPermission(
                        this,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED;

        return fineGranted || coarseGranted;
    }

    private boolean shouldSkip(double lat, double lng) {
        long now = System.currentTimeMillis();

        if (lastSentAt == 0L) {
            return false;
        }

        double distanceMeters = distanceBetweenMeters(lastLat, lastLng, lat, lng);
        long elapsed = now - lastSentAt;

        return distanceMeters < 5 && elapsed < 15000;
    }

    private void sendLocationToBackend(double lat, double lng) {
        new Thread(() -> {
            try {
                String cleanBase = apiBaseUrl.endsWith("/")
                        ? apiBaseUrl.substring(0, apiBaseUrl.length() - 1)
                        : apiBaseUrl;

                String url = cleanBase + "/enterprise-drivers/" + driverId + "/location";

                JSONObject json = new JSONObject();
                json.put("lat", round6(lat));
                json.put("lng", round6(lng));

                Log.d(TAG, "Enviando ubicación a: " + url);
                Log.d(TAG, "Payload: " + json.toString());

                RequestBody body = RequestBody.create(
                        json.toString(),
                        MediaType.parse("application/json; charset=utf-8")
                );

                Request request = new Request.Builder()
                        .url(url)
                        .patch(body)
                        .addHeader("Authorization", "Bearer " + token)
                        .addHeader("Content-Type", "application/json")
                        .build();

                try (Response response = httpClient.newCall(request).execute()) {
                    String responseBody = response.body() != null
                            ? response.body().string()
                            : "";

                    if (response.isSuccessful()) {
                        lastLat = lat;
                        lastLng = lng;
                        lastSentAt = System.currentTimeMillis();

                        Log.d(TAG, "Ubicación enviada correctamente al backend");
                        Log.d(TAG, "Respuesta backend: " + responseBody);
                    } else {
                        Log.e(TAG, "Error backend ubicación. Código: " + response.code());
                        Log.e(TAG, "Respuesta backend: " + responseBody);
                    }
                }

            } catch (IOException error) {
                Log.e(TAG, "Error de red enviando ubicación al backend", error);
            } catch (Exception error) {
                Log.e(TAG, "Error preparando/enviando request de ubicación", error);
            }
        }).start();
    }

    private Notification buildNotification(String contentText) {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Central Go")
                .setContentText(contentText)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Central Go Ubicación",
                    NotificationManager.IMPORTANCE_LOW
            );

            channel.setDescription("Canal de seguimiento de ubicación en segundo plano");

            NotificationManager manager = getSystemService(NotificationManager.class);

            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private double distanceBetweenMeters(double lat1, double lng1, double lat2, double lng2) {
        double earthRadius = 6371000.0;

        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);

        double a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(Math.toRadians(lat1)) *
                                Math.cos(Math.toRadians(lat2)) *
                                Math.sin(dLng / 2) *
                                Math.sin(dLng / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return earthRadius * c;
    }

    private double round6(double value) {
        return Math.round(value * 1000000d) / 1000000d;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();

        Log.d(TAG, "onDestroy ejecutado");

        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }

        locationUpdatesStarted = false;

        Log.d(TAG, "Servicio de ubicación detenido");
    }

    @Nullable
    @Override
    public IBinder onBind(android.content.Intent intent) {
        return null;
    }
}