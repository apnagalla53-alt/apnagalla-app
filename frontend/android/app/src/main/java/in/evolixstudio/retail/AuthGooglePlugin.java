package in.evolixstudio.retail;

import android.content.MutableContextWrapper;
import android.os.CancellationSignal;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import java.util.concurrent.atomic.AtomicBoolean;

/** Native account selection only. The API verifies the returned credential and nonce. */
@CapacitorPlugin(name = "EvolixGoogleAuth")
public class AuthGooglePlugin extends Plugin {
    private final AtomicBoolean signingIn = new AtomicBoolean(false);
    private CancellationSignal activeRequest;

    @PluginMethod
    public void signIn(PluginCall call) {
        String clientId = call.getString("clientId");
        String nonce = call.getString("nonce");
        if (clientId == null || !clientId.endsWith(".apps.googleusercontent.com") ||
            nonce == null || !nonce.matches("[A-Za-z0-9_-]{32,128}")) {
            call.reject("Google sign in is not configured.", "NOT_CONFIGURED");
            return;
        }
        if (!signingIn.compareAndSet(false, true)) {
            call.reject("Finish the current Google sign in first.", "IN_PROGRESS");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(clientId)
                    .setNonce(nonce).build();
                GetCredentialRequest request = new GetCredentialRequest.Builder()
                    .addCredentialOption(option).build();
                activeRequest = new CancellationSignal();
                CredentialManager.create(getContext()).getCredentialAsync(
                    new MutableContextWrapper(getActivity()), request, activeRequest,
                    ContextCompat.getMainExecutor(getContext()),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override public void onResult(GetCredentialResponse response) {
                            signingIn.set(false); activeRequest = null;
                            try {
                                Credential credential = response.getCredential();
                                if (!(credential instanceof CustomCredential) ||
                                    !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                                    call.reject("Google did not return a sign-in credential.", "INVALID_CREDENTIAL");
                                    return;
                                }
                                GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                                JSObject result = new JSObject(); result.put("credential", google.getIdToken());
                                // No ID token, email, password or provider exception is logged or persisted.
                                call.resolve(result);
                            } catch (Exception ignored) {
                                call.reject("Google sign in could not be read. Please retry.", "INVALID_CREDENTIAL");
                            }
                        }
                        @Override public void onError(GetCredentialException ignored) {
                            signingIn.set(false); activeRequest = null;
                            call.reject("Google sign in was cancelled or unavailable. You can use your shop password.", "GOOGLE_UNAVAILABLE");
                        }
                    });
            } catch (Exception ignored) {
                signingIn.set(false); activeRequest = null;
                call.reject("Google sign in is unavailable. You can use your shop password.", "GOOGLE_UNAVAILABLE");
            }
        });
    }

    @PluginMethod
    public void clearSession(PluginCall call) {
        CredentialManager.create(getContext()).clearCredentialStateAsync(new ClearCredentialStateRequest(), null,
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override public void onResult(Void ignored) { call.resolve(); }
                @Override public void onError(ClearCredentialException ignored) {
                    call.reject("Google credential state could not be cleared.", "CLEAR_UNAVAILABLE");
                }
            });
    }

    @Override protected void handleOnDestroy() {
        if (activeRequest != null) activeRequest.cancel();
        activeRequest = null; signingIn.set(false); super.handleOnDestroy();
    }
}
