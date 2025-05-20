import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { PreloadAllModules, provideRouter, Router, RouteReuseStrategy, withPreloading } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { routes } from './app/app.routes';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { HttpClientModule } from '@angular/common/http';


import { IonicStorageModule } from '@ionic/storage-angular';
import { Drivers } from '@ionic/storage';
import CordovaSQLiteDriver from 'localforage-cordovasqlitedriver';


export const appConfig: ApplicationConfig = {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    importProvidersFrom(IonicStorageModule.forRoot({
      name: 'finvia',
      driverOrder: [CordovaSQLiteDriver._driver, Drivers.IndexedDB, Drivers.LocalStorage]
    })
  ),

    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    HttpClientModule
  ]
};
