import Cocoa
import WebKit

final class EstudioDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, WKDownloadDelegate, NSWindowDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var web: WKWebView!
    var process: Process?
    var origin = ""
    var output = ""
    var ready = false
    var quitting = false
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.appearance = NSAppearance(named: .darkAqua)
        let menu = NSMenu(), appMenu = NSMenu(), appItem = NSMenuItem()
        appMenu.addItem(withTitle: "Acerca de Estudio", action: #selector(about), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Salir de Estudio", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu; menu.addItem(appItem)
        let editItem = NSMenuItem(), editMenu = NSMenu(title: "Editar")
        for (title, selector, key) in [("Deshacer", "undo:", "z"), ("Cortar", "cut:", "x"), ("Copiar", "copy:", "c"), ("Pegar", "paste:", "v"), ("Seleccionar todo", "selectAll:", "a")] {
            editMenu.addItem(withTitle: title, action: Selector(selector), keyEquivalent: key)
        }
        editItem.submenu = editMenu; menu.addItem(editItem); NSApp.mainMenu = menu
        let config = WKWebViewConfiguration()
        config.userContentController.add(self,name:"chooseLibrary")
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        web = WKWebView(frame: .zero, configuration: config); web.uiDelegate = self; web.navigationDelegate = self
        web.setValue(false, forKey: "drawsBackground")
        window = NSWindow(contentRect: NSRect(x: 0,y: 0,width: 1280,height: 820), styleMask: [.titled,.closable,.miniaturizable,.resizable], backing: .buffered, defer: false)
        window.title = "Estudio"; window.minSize = NSSize(width: 850,height: 600); window.backgroundColor = NSColor(calibratedRed: 0.04,green: 0.04,blue: 0.08,alpha: 1)
        window.contentView = web; window.delegate = self; window.center(); window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        web.loadHTMLString("<html lang='es'><body style='background:#0a0b14;color:#80e9ff;font:20px -apple-system;padding:80px'>Iniciando Estudio…</body></html>", baseURL: nil)
        startServer()
    }
    @objc func about() { let a=NSAlert(); a.messageText="Estudio · edición personal"; a.informativeText="Organización local de proyectos. Interfaz oscura y almacenamiento bajo tu control. Versión experimental para Apple Silicon."; a.runModal() }
    func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage){
        guard message.name=="chooseLibrary",let url=web.url,url.absoluteString.hasPrefix(origin+"/") else{return}
        let panel=NSOpenPanel();panel.title="Elegir biblioteca de Estudio";panel.canChooseDirectories=true;panel.canChooseFiles=false;panel.canCreateDirectories=true;panel.allowsMultipleSelection=false
        panel.beginSheetModal(for:window){result in if result == .OK,let url=panel.url {self.web.callAsyncJavaScript("document.querySelector('[aria-label=\"Ruta de la biblioteca\"]').value = path",arguments:["path":url.path],in:nil,in:.page,completionHandler:nil)}}
    }
    func startServer() {
        guard let resources=Bundle.main.resourceURL else { return }
        let support=FileManager.default.urls(for: .applicationSupportDirectory,in: .userDomainMask)[0].appendingPathComponent("Estudio",isDirectory:true)
        do { try FileManager.default.createDirectory(at: support,withIntermediateDirectories:true) } catch { fail(error.localizedDescription); return }
        var data=support.appendingPathComponent("Biblioteca",isDirectory:true).path
        if let initial=try? String(contentsOf:resources.appendingPathComponent("InitialLibrary.txt"),encoding:.utf8), FileManager.default.fileExists(atPath:initial.trimmingCharacters(in:.whitespacesAndNewlines)) {data=initial.trimmingCharacters(in:.whitespacesAndNewlines)}
        let p=Process(), pipe=Pipe(); process=p
        p.executableURL=resources.appendingPathComponent("runtime/node")
        p.arguments=[resources.appendingPathComponent("app/server.mjs").path]
        p.currentDirectoryURL=resources.appendingPathComponent("app")
        p.environment=["PATH":"/usr/bin:/bin","HOME":NSHomeDirectory(),"PORT":"0","ESTUDIO_DATA_DIR":data,"ESTUDIO_SETTINGS":support.appendingPathComponent("settings.json").path]
        p.standardOutput=pipe; p.standardError=pipe
        pipe.fileHandleForReading.readabilityHandler={ [weak self] handle in
            let bytes=handle.availableData
            guard !bytes.isEmpty, let text=String(data:bytes,encoding:.utf8) else{return}
            DispatchQueue.main.async {
                guard let self=self else{return}; self.output += text
                if self.output.count>16000 {self.output=String(self.output.suffix(16000))}
                if !self.ready, let line=self.output.components(separatedBy:"\n").first(where:{$0.hasPrefix("Estudio disponible en http://127.0.0.1:")}), let url=URL(string:line.replacingOccurrences(of:"Estudio disponible en ",with:"")) {
                    self.ready=true; self.origin=url.absoluteString; self.web.load(URLRequest(url:url))
                }
            }
        }
        p.terminationHandler={ [weak self] p in DispatchQueue.main.async {if let self=self,!self.quitting {self.fail("El servicio local se detuvo. Tus datos permanecen en la biblioteca.\n\n"+self.output)}} }
        do {try p.run()} catch {fail(error.localizedDescription)}
    }
    func fail(_ text:String) {let a=NSAlert();a.messageText="No se pudo iniciar Estudio";a.informativeText=text;a.addButton(withTitle:"Cerrar");a.runModal();NSApp.terminate(nil)}
    func applicationShouldTerminate(_ sender:NSApplication)->NSApplication.TerminateReply {
        if quitting{return .terminateNow}
        guard ready else {quitting=true;return .terminateNow}
        web.evaluateJavaScript("window.estudioHasPendingChanges?.() === true") {value,error in
            if value as? Bool == true {let alert=NSAlert();alert.messageText="Hay cambios pendientes";alert.informativeText="Vuelve a la página y guarda antes de salir.";alert.addButton(withTitle:"Volver y guardar");alert.addButton(withTitle:"Salir sin guardar");if alert.runModal() == .alertFirstButtonReturn {NSApp.reply(toApplicationShouldTerminate:false);return}}
            self.quitting=true;NSApp.reply(toApplicationShouldTerminate:true)
        };return .terminateLater
    }
    func applicationWillTerminate(_ notification:Notification){quitting=true;if let p=process,p.isRunning{p.terminate()}}
    func windowShouldClose(_ sender:NSWindow)->Bool{NSApp.terminate(nil);return false}
    func applicationShouldHandleReopen(_ sender:NSApplication,hasVisibleWindows flag:Bool)->Bool{window.makeKeyAndOrderFront(nil);return true}
    func webView(_ webView:WKWebView,decidePolicyFor navigationAction:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void){
        guard let url=navigationAction.request.url else{decisionHandler(.cancel);return}
        if url.absoluteString.hasPrefix(origin+"/") || url.absoluteString==origin || url.scheme=="about" {decisionHandler(navigationAction.shouldPerformDownload ? .download : .allow);return}
        if navigationAction.navigationType == .linkActivated, ["https","http","mailto"].contains(url.scheme ?? "") {NSWorkspace.shared.open(url)}
        decisionHandler(.cancel)
    }
    func webView(_ webView:WKWebView,decidePolicyFor navigationResponse:WKNavigationResponse,decisionHandler:@escaping(WKNavigationResponsePolicy)->Void){
        if let r=navigationResponse.response as? HTTPURLResponse, r.value(forHTTPHeaderField:"Content-Disposition")?.hasPrefix("attachment")==true {decisionHandler(.download)} else {decisionHandler(.allow)}
    }
    func webView(_ webView:WKWebView,navigationAction:WKNavigationAction,didBecome download:WKDownload){download.delegate=self}
    func webView(_ webView:WKWebView,navigationResponse:WKNavigationResponse,didBecome download:WKDownload){download.delegate=self}
    func download(_ download:WKDownload,decideDestinationUsing response:URLResponse,suggestedFilename:String,completionHandler:@escaping(URL?)->Void){let panel=NSSavePanel();panel.title="Guardar archivo";panel.nameFieldStringValue=suggestedFilename;panel.beginSheetModal(for:window){result in completionHandler(result == .OK ? panel.url : nil)}}
    func webView(_ webView:WKWebView,runOpenPanelWith parameters:WKOpenPanelParameters,initiatedByFrame frame:WKFrameInfo,completionHandler:@escaping([URL]?)->Void){let panel=NSOpenPanel();panel.title="Seleccionar archivos";panel.canChooseFiles=true;panel.canChooseDirectories=false;panel.allowsMultipleSelection=parameters.allowsMultipleSelection;panel.beginSheetModal(for:window){result in completionHandler(result == .OK ? panel.urls : nil)}}
}
let app=NSApplication.shared
let delegate=EstudioDelegate()
app.delegate=delegate
app.setActivationPolicy(.regular)
app.run()
