import { useEffect, useRef, useState } from 'react';
import { api, type Appearance, type Protocol, type SettingsView, type SettingsPatch } from './api';
import { ReadMode } from './EmailBody';
import { destination } from './mailPresentation';
export function useSettings() {
    const [theme, setTheme] = useState(() => { try {
        return localStorage.getItem('aurora-theme') || 'dark';
    }
    catch {
        return 'dark';
    } });
    const [density, setDensity] = useState(() => { try {
        return localStorage.getItem('aurora-density') || 'comfortable';
    }
    catch {
        return 'comfortable';
    } });
    const [readMode, setReadMode] = useState<ReadMode>(() => { try {
        const saved = localStorage.getItem('aurora-read-mode');
        return saved === 'Original' || saved === 'Plain Text' ? saved : 'Adaptive';
    }
    catch {
        return 'Adaptive';
    } });
    const [appSettings, setAppSettings] = useState<SettingsView | null>(null);
    const [settingsBusy, setSettingsBusy] = useState(false);
    const settingsPending = useRef(false);
    const [settingsError, setSettingsError] = useState('');
    const [aiKey, setAiKey] = useState('');
    const [aiModel, setAiModel] = useState('claude-opus-5-5');
    const [aiProtocol, setAiProtocol] = useState<Protocol>('anthropic');
    const [aiEndpoint, setAiEndpoint] = useState('https://api.anthropic.com/v1/messages');
    const [aiEnabled, setAiEnabled] = useState(false);
    function applyAppearance(a: Appearance) { setTheme(a.theme); setDensity(a.density); setReadMode(a.read_mode); }
    function hydrate(next: SettingsView) {
        setAppSettings(next);
        setAiModel(next.ai.model);
        setAiProtocol(next.ai.protocol);
        setAiEndpoint(next.ai.endpoint);
        setAiEnabled(next.ai.enabled);
        if (next.appearance)
            applyAppearance(next.appearance);
    }
    async function persistSettings(patch: SettingsPatch) {
        if (settingsPending.current)
            return;
        settingsPending.current = true;
        setSettingsBusy(true);
        setSettingsError('');
        try {
            const next = await api.patchSettings(patch);
            hydrate(next);
            setAiKey('');
        }
        catch (cause) {
            setSettingsError(String(cause));
        }
        finally {
            settingsPending.current = false;
            setSettingsBusy(false);
        }
    }
    useEffect(() => {
        const controller = new AbortController();
        void (async () => {
            try {
                const next = await api.settings(controller.signal);
                if (controller.signal.aborted)
                    return;
                hydrate(next);
                if (!next.appearance)
                    await persistSettings({ appearance: { theme, density, read_mode: readMode } });
            }
            catch (cause) {
                if (!controller.signal.aborted)
                    setSettingsError(String(cause));
            }
        })();
        return () => controller.abort();
    }, []);
    function saveAiSettings() {
        const changed = aiEndpoint !== appSettings?.ai.endpoint || aiProtocol !== appSettings?.ai.protocol;
        if (changed && appSettings?.ai.key_configured && !aiKey) {
            setSettingsError('Ganti atau hapus API key sebelum mengubah URL atau format API.');
            return;
        }
        if (changed && !confirm(`Simpan tujuan API ${destination(aiEndpoint)}? Key dan instruksi akan dikirim ke tujuan ini saat AI digunakan. Hanya gunakan URL yang dipercaya.`))
            return;
        void persistSettings({ model: aiModel, protocol: aiProtocol, endpoint: aiEndpoint, enabled: aiEnabled, ...(aiKey ? { api_key: aiKey } : {}) });
    }
    function changeAppearance(a: Appearance) {
        if (settingsPending.current)
            return;
        if (appSettings)
            void persistSettings({ appearance: a });
        else {
            applyAppearance(a);
            setSettingsError('Tampilan hanya sementara; pengaturan server belum tersedia.');
        }
        try {
            localStorage.setItem('aurora-theme', a.theme);
            localStorage.setItem('aurora-density', a.density);
            localStorage.setItem('aurora-read-mode', a.read_mode);
        }
        catch { }
    }
    return { appSettings, density, theme, readMode, settingsBusy, changeAppearance, aiProtocol, setAiProtocol, aiEndpoint, setAiEndpoint, aiModel, setAiModel, aiKey, setAiKey, aiEnabled, setAiEnabled, saveAiSettings, persistSettings, settingsError };
}
