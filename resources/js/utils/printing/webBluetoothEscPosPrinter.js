const STORAGE_KEY = 'warehouse.bluetoothPrinterPreference.v1';

const CANDIDATE_SERVICE_UUIDS = [
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000fff0-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000ae30-0000-1000-8000-00805f9b34fb',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

const CANDIDATE_CHARACTERISTIC_UUIDS = [
    '0000ffe1-0000-1000-8000-00805f9b34fb',
    '0000ffe2-0000-1000-8000-00805f9b34fb',
    '0000fff1-0000-1000-8000-00805f9b34fb',
    '0000fff2-0000-1000-8000-00805f9b34fb',
    '0000ff02-0000-1000-8000-00805f9b34fb',
    '0000ae01-0000-1000-8000-00805f9b34fb',
    '49535343-8841-43f4-a8d4-ecbe34729bb3',
];

function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeUuid(value) {
    return String(value || '').trim().toLowerCase();
}

function isWritableCharacteristic(characteristic) {
    const props = characteristic?.properties;
    return Boolean(props?.write || props?.writeWithoutResponse);
}

function serializeError(error, fallbackMessage = 'Printer error') {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (typeof error === 'string' && error.trim()) {
        return error.trim();
    }

    return fallbackMessage;
}

function loadSavedPreference() {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function savePreference(preference) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
    } catch {
        return;
    }
}

function clearPreference() {
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        return;
    }
}

async function resolveWritableEndpoint(server, serviceHint, characteristicHint) {
    const triedServices = new Set();
    const serviceQueue = [serviceHint, ...CANDIDATE_SERVICE_UUIDS].filter(Boolean).map(normalizeUuid);
    const characteristicQueue = [characteristicHint, ...CANDIDATE_CHARACTERISTIC_UUIDS].filter(Boolean).map(normalizeUuid);

    for (const serviceUuid of serviceQueue) {
        if (!serviceUuid || triedServices.has(serviceUuid)) {
            continue;
        }

        triedServices.add(serviceUuid);

        let service;
        try {
            service = await server.getPrimaryService(serviceUuid);
        } catch {
            continue;
        }

        const triedCharacteristics = new Set();
        for (const characteristicUuid of characteristicQueue) {
            if (!characteristicUuid || triedCharacteristics.has(characteristicUuid)) {
                continue;
            }

            triedCharacteristics.add(characteristicUuid);

            try {
                const characteristic = await service.getCharacteristic(characteristicUuid);
                if (isWritableCharacteristic(characteristic)) {
                    return { service, characteristic };
                }
            } catch {
                continue;
            }
        }

        try {
            const characteristics = await service.getCharacteristics();
            const writable = characteristics.find((candidate) => isWritableCharacteristic(candidate));
            if (writable) {
                return { service, characteristic: writable };
            }
        } catch {
            continue;
        }
    }

    throw new Error('No writable ESC/POS BLE characteristic was found on the selected printer.');
}

export function getBluetoothSupportState() {
    if (typeof window === 'undefined') {
        return { supported: false, reason: 'Browser environment is not available.' };
    }

    if (!window.isSecureContext) {
        return { supported: false, reason: 'Web Bluetooth requires HTTPS or localhost.' };
    }

    if (!navigator.bluetooth) {
        return { supported: false, reason: 'This browser does not support Web Bluetooth.' };
    }

    return { supported: true, reason: null };
}

export class WebBluetoothEscPosPrinter {
    constructor() {
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristic = null;
        this.handleDeviceDisconnected = this.handleDeviceDisconnected.bind(this);
    }

    get support() {
        return getBluetoothSupportState();
    }

    get savedPreference() {
        return loadSavedPreference();
    }

    get connectionInfo() {
        return {
            connected: Boolean(this.device?.gatt?.connected && this.characteristic),
            deviceId: this.device?.id || null,
            deviceName: this.device?.name || this.savedPreference?.name || null,
            serviceUuid: this.service?.uuid || this.savedPreference?.serviceUuid || null,
            characteristicUuid: this.characteristic?.uuid || this.savedPreference?.characteristicUuid || null,
        };
    }

    rememberSelectedPrinter(extra = {}) {
        const info = this.connectionInfo;
        if (!info.deviceId) {
            return;
        }

        savePreference({
            deviceId: info.deviceId,
            name: info.deviceName,
            serviceUuid: info.serviceUuid,
            characteristicUuid: info.characteristicUuid,
            ...extra,
        });
    }

    forgetSelectedPrinter() {
        clearPreference();
    }

    async requestDevice() {
        const support = this.support;
        if (!support.supported) {
            throw new Error(support.reason);
        }

        return navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: CANDIDATE_SERVICE_UUIDS,
        });
    }

    async connect(device, hints = {}) {
        if (!device) {
            throw new Error('No Bluetooth printer was selected.');
        }

        await this.disconnect({ forget: false, silent: true });

        this.device = device;
        this.device.removeEventListener('gattserverdisconnected', this.handleDeviceDisconnected);
        this.device.addEventListener('gattserverdisconnected', this.handleDeviceDisconnected);

        const server = await device.gatt.connect();
        const endpoint = await resolveWritableEndpoint(server, hints.serviceUuid, hints.characteristicUuid);

        this.server = server;
        this.service = endpoint.service;
        this.characteristic = endpoint.characteristic;
        this.rememberSelectedPrinter();

        return this.connectionInfo;
    }

    async requestAndConnect() {
        const device = await this.requestDevice();
        return this.connect(device);
    }

    async reconnectSavedPrinter() {
        const support = this.support;
        if (!support.supported) {
            throw new Error(support.reason);
        }

        const preference = this.savedPreference;
        if (!preference?.deviceId) {
            return null;
        }

        if (typeof navigator.bluetooth.getDevices !== 'function') {
            throw new Error('Saved printer reconnect is not supported by this browser. Use Connect Printer once.');
        }

        const devices = await navigator.bluetooth.getDevices();
        const device = devices.find((candidate) => candidate.id === preference.deviceId);
        if (!device) {
            throw new Error('Saved printer not found. Reconnect the printer manually once.');
        }

        return this.connect(device, preference);
    }

    async print(data, options = {}) {
        if (!(data instanceof Uint8Array) || data.length === 0) {
            throw new Error('Nothing to print.');
        }

        if (!this.characteristic || !this.device?.gatt?.connected) {
            throw new Error('Printer is not connected.');
        }

        const chunkSize = Number(options.chunkSize) > 0 ? Number(options.chunkSize) : 180;
        const pauseMs = Number(options.pauseMs) >= 0 ? Number(options.pauseMs) : 20;

        for (let offset = 0; offset < data.length; offset += chunkSize) {
            const chunk = data.slice(offset, offset + chunkSize);

            if (typeof this.characteristic.writeValueWithoutResponse === 'function' && this.characteristic.properties?.writeWithoutResponse) {
                await this.characteristic.writeValueWithoutResponse(chunk);
            } else {
                await this.characteristic.writeValue(chunk);
            }

            if (pauseMs > 0) {
                await delay(pauseMs);
            }
        }

        return true;
    }

    async disconnect({ forget = false, silent = false } = {}) {
        try {
            if (this.device) {
                this.device.removeEventListener('gattserverdisconnected', this.handleDeviceDisconnected);
            }

            if (this.device?.gatt?.connected) {
                this.device.gatt.disconnect();
            }
        } catch (error) {
            if (!silent) {
                throw new Error(serializeError(error, 'Failed to disconnect printer.'));
            }
        } finally {
            this.device = null;
            this.server = null;
            this.service = null;
            this.characteristic = null;
            if (forget) {
                this.forgetSelectedPrinter();
            }
        }
    }

    handleDeviceDisconnected() {
        this.server = null;
        this.service = null;
        this.characteristic = null;
    }
}

export function mapBluetoothError(error) {
    const message = serializeError(error);

    if (/user cancelled|user canceled|notfounderror/i.test(message)) {
        return 'Printer selection was cancelled.';
    }

    if (/secure context|https|localhost/i.test(message)) {
        return 'Web Bluetooth requires HTTPS on Android Chrome.';
    }

    if (/gatt server is disconnected|not connected/i.test(message)) {
        return 'The printer disconnected. Reconnect and try again.';
    }

    if (/no writable esc\/pos ble characteristic/i.test(message)) {
        return 'This printer does not expose a supported BLE ESC/POS write characteristic.';
    }

    return message;
}
