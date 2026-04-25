package co.com.mercalan.centralgo;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
        name = "BackgroundLocationPlugin",
        permissions = {
                @Permission(
                        strings = {
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                        },
                        alias = "location"
                ),
                @Permission(
                        strings = {
                                Manifest.permission.ACCESS_BACKGROUND_LOCATION
                        },
                        alias = "backgroundLocation"
                )
        }
)
public class BackgroundLocationPlugin extends Plugin {

    private static final String TAG = "BackgroundLocationPlugin";

    @PluginMethod
    public void startTracking(PluginCall call) {
        Log.d(TAG, "========================================");
        Log.d(TAG, "startTracking llamado desde React");
        Log.d(TAG, "========================================");

        String driverId = call.getString("driverId", "");
        String token = call.getString("token", "");
        String apiBaseUrl = call.getString("apiBaseUrl", "");

        Log.d(TAG, "driverId: " + driverId);
        Log.d(TAG, "token presente: " + (!token.isEmpty()));
        Log.d(TAG, "apiBaseUrl: " + apiBaseUrl);

        if (driverId == null || driverId.trim().isEmpty()) {
            Log.e(TAG, "Falta driverId");
            call.reject("driverId es obligatorio");
            return;
        }

        if (token == null || token.trim().isEmpty()) {
            Log.e(TAG, "Falta token");
            call.reject("token es obligatorio");
            return;
        }

        if (apiBaseUrl == null || apiBaseUrl.trim().isEmpty()) {
            Log.e(TAG, "Falta apiBaseUrl");
            call.reject("apiBaseUrl es obligatorio");
            return;
        }

        boolean fineGranted =
                ActivityCompat.checkSelfPermission(
                        getContext(),
                        Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED;

        boolean coarseGranted =
                ActivityCompat.checkSelfPermission(
                        getContext(),
                        Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED;

        if (!fineGranted && !coarseGranted) {
            Log.d(TAG, "No hay permiso foreground. Solicitando permiso location...");
            requestPermissionForAlias("location", call, "locationPermissionCallback");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            boolean backgroundGranted =
                    ActivityCompat.checkSelfPermission(
                            getContext(),
                            Manifest.permission.ACCESS_BACKGROUND_LOCATION
                    ) == PackageManager.PERMISSION_GRANTED;

            if (!backgroundGranted) {
                Log.e(TAG, "Falta ACCESS_BACKGROUND_LOCATION");

                try {
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
                    intent.setData(uri);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                } catch (Exception error) {
                    Log.e(TAG, "No se pudo abrir configuración de la app", error);
                }

                call.reject(
                        "Falta permiso de ubicación en segundo plano. En la configuración de la app activa: Ubicación > Permitir todo el tiempo."
                );
                return;
            }
        }

        startServiceInternal(call);
    }

    @PermissionCallback
    private void locationPermissionCallback(PluginCall call) {
        Log.d(TAG, "locationPermissionCallback ejecutado");

        PermissionState locationState = getPermissionState("location");

        Log.d(TAG, "Estado permiso location: " + locationState);

        if (locationState != PermissionState.GRANTED) {
            call.reject("Permiso de ubicación denegado.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            boolean backgroundGranted =
                    ActivityCompat.checkSelfPermission(
                            getContext(),
                            Manifest.permission.ACCESS_BACKGROUND_LOCATION
                    ) == PackageManager.PERMISSION_GRANTED;

            if (!backgroundGranted) {
                Log.e(TAG, "Foreground concedido, pero falta background location");

                try {
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
                    intent.setData(uri);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                } catch (Exception error) {
                    Log.e(TAG, "No se pudo abrir configuración de permisos", error);
                }

                call.reject(
                        "Ahora activa manualmente: Ubicación > Permitir todo el tiempo. Luego vuelve a la app y presiona nuevamente Activar GPS segundo plano."
                );
                return;
            }
        }

        startServiceInternal(call);
    }

    private void startServiceInternal(PluginCall call) {
        String driverId = call.getString("driverId", "");
        String token = call.getString("token", "");
        String apiBaseUrl = call.getString("apiBaseUrl", "");

        Log.d(TAG, "========================================");
        Log.d(TAG, "Iniciando LocationForegroundService");
        Log.d(TAG, "driverId: " + driverId);
        Log.d(TAG, "token presente: " + (!token.isEmpty()));
        Log.d(TAG, "apiBaseUrl: " + apiBaseUrl);
        Log.d(TAG, "========================================");

        try {
            Intent intent = new Intent(getContext(), LocationForegroundService.class);
            intent.putExtra("driverId", driverId);
            intent.putExtra("token", token);
            intent.putExtra("apiBaseUrl", apiBaseUrl);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }

            JSObject ret = new JSObject();
            ret.put("started", true);
            ret.put("driverId", driverId);
            ret.put("service", "LocationForegroundService");
            call.resolve(ret);

            Log.d(TAG, "LocationForegroundService iniciado correctamente");

        } catch (Exception error) {
            Log.e(TAG, "Error iniciando LocationForegroundService", error);
            call.reject("No se pudo iniciar el servicio de ubicación: " + error.getMessage());
        }
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        Log.d(TAG, "stopTracking llamado");

        try {
            Intent intent = new Intent(getContext(), LocationForegroundService.class);
            getContext().stopService(intent);

            JSObject ret = new JSObject();
            ret.put("stopped", true);
            call.resolve(ret);

            Log.d(TAG, "LocationForegroundService detenido correctamente");

        } catch (Exception error) {
            Log.e(TAG, "Error deteniendo LocationForegroundService", error);
            call.reject("No se pudo detener el servicio de ubicación: " + error.getMessage());
        }
    }
}