package in.evolixstudio.retail;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.text.TextUtils;
import android.util.Base64;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name="EvolixDevice")
public class DeviceActionsPlugin extends Plugin {
    private WebView qrPrintView;
    @PluginMethod public void openWhatsApp(PluginCall call) {
        try {
            String value=call.getString("url","");Uri uri=Uri.parse(value);
            if(value.length()>30000||!"https".equals(uri.getScheme())||!"wa.me".equals(uri.getHost())||uri.getUserInfo()!=null||uri.getPort()!=-1||!uri.getPath().matches("/[1-9][0-9]{7,14}"))throw new IllegalArgumentException();
            getActivity().runOnUiThread(()->{try{getActivity().startActivity(new Intent(Intent.ACTION_VIEW,uri));call.resolve(new JSObject().put("chat_open_requested",true));}catch(Exception e){call.reject("WhatsApp or a web browser is unavailable");}});
        }catch(Exception e){call.reject("Invalid WhatsApp destination");}
    }
    private byte[] png(PluginCall call) {
        String value=call.getString("png","");
        if(!value.startsWith("data:image/png;base64,")||value.length()>2800000)throw new IllegalArgumentException();
        byte[] bytes=Base64.decode(value.substring(22),Base64.DEFAULT);
        byte[] signature={(byte)137,80,78,71,13,10,26,10};
        if(bytes.length<signature.length||bytes.length>2000000)throw new IllegalArgumentException();
        for(int i=0;i<signature.length;i++)if(bytes[i]!=signature[i])throw new IllegalArgumentException();
        return bytes;
    }
    private String text(PluginCall call,String key) {
        String value=call.getString(key,"EVOLIX");
        if(value.length()>200)throw new IllegalArgumentException();
        return value;
    }
    private void print(WebView view,String title,PluginCall call) {
        PrintManager manager=(PrintManager)getActivity().getSystemService(Context.PRINT_SERVICE);
        if(manager==null){call.reject("Printing is unavailable on this device");return;}
        PrintDocumentAdapter adapter=view.createPrintDocumentAdapter(title);
        manager.print(title,adapter,new PrintAttributes.Builder().build());
        // Opening a system dialog is not confirmation that paper was printed.
        call.resolve(new JSObject().put("dialog_opened",true));
    }
    @PluginMethod public void printPage(PluginCall call) {
        getActivity().runOnUiThread(()->{try{print(getBridge().getWebView(),"EVOLIX invoice",call);}catch(Exception e){call.reject("Could not open printing");}});
    }
    @PluginMethod public void printQr(PluginCall call) {
        try {
            byte[] bytes=png(call);String title=text(call,"title"),subtitle=text(call,"subtitle");
            String html="<!doctype html><html><meta name='viewport' content='width=device-width'><body style='font-family:sans-serif;text-align:center'><h1>"+TextUtils.htmlEncode(title)+"</h1><img style='width:300px;max-width:100%' src='data:image/png;base64,"+Base64.encodeToString(bytes,Base64.NO_WRAP)+"'><p>"+TextUtils.htmlEncode(subtitle)+"</p><p>EVOLIX Retail</p></body></html>";
            getActivity().runOnUiThread(()->{
                try {
                    if(qrPrintView!=null)qrPrintView.destroy();
                    qrPrintView=new WebView(getActivity());qrPrintView.getSettings().setJavaScriptEnabled(false);qrPrintView.getSettings().setAllowFileAccess(false);qrPrintView.getSettings().setAllowContentAccess(false);
                    qrPrintView.setWebViewClient(new WebViewClient(){@Override public void onPageFinished(WebView view,String url){try{print(view,"EVOLIX shop QR",call);}catch(Exception e){call.reject("Could not open QR printing");}}});
                    qrPrintView.loadDataWithBaseURL(null,html,"text/html","UTF-8",null);
                }catch(Exception e){call.reject("Could not open QR printing");}
            });
        }catch(Exception e){call.reject("Invalid QR image");}
    }
    @PluginMethod public void shareQr(PluginCall call) {
        try {
            byte[] bytes=png(call);String title=text(call,"title");
            File directory=new File(getContext().getCacheDir(),"shared-qr");
            if(!directory.exists()&&!directory.mkdirs())throw new IllegalStateException();
            File[] old=directory.listFiles();if(old!=null)for(File file:old)if(file.isFile()&&file.lastModified()<System.currentTimeMillis()-86400000L)file.delete();
            File image=File.createTempFile("evolix-qr-",".png",directory);
            try(FileOutputStream stream=new FileOutputStream(image)){stream.write(bytes);}
            Uri uri=FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".fileprovider",image);
            Intent send=new Intent(Intent.ACTION_SEND);send.setType("image/png");send.putExtra(Intent.EXTRA_STREAM,uri);send.putExtra(Intent.EXTRA_SUBJECT,title);send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().runOnUiThread(()->{try{getActivity().startActivity(Intent.createChooser(send,"Share shop QR"));call.resolve(new JSObject().put("chooser_opened",true));}catch(Exception e){call.reject("Sharing is unavailable on this device");}});
        }catch(Exception e){call.reject("Could not prepare QR sharing");}
    }
    @Override protected void handleOnDestroy(){if(qrPrintView!=null){qrPrintView.destroy();qrPrintView=null;}super.handleOnDestroy();}
}
