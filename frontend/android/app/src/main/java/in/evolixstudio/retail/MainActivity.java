package in.evolixstudio.retail;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AuthGooglePlugin.class);
        registerPlugin(DeviceActionsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
