declare module 'react-native-thermal-printer' {
  const ThermalPrinterModule: {
    defaultConfig: Record<string, any>;
    printBluetooth(config: Record<string, any>): Promise<void>;
    printTcp(config: Record<string, any>): Promise<void>;
  };

  export default ThermalPrinterModule;
}
