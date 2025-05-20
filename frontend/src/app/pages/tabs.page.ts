import { NgStyle } from '@angular/common';
import { Component, EnvironmentInjector, inject, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonTabs, IonTabBar, IonTabButton, IonLabel, IonButton, IonButtons, AlertController } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular/standalone';

import { Camera } from "@capacitor/camera";
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner';

import { StorageService } from '../services/storage/storage.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonButton, IonButtons, IonLabel, IonTabs, IonTabBar, IonTabButton, RouterModule, NgStyle ],
})
export class TabsPage {
  public environmentInjector = inject(EnvironmentInjector);
  @ViewChild('tabs', {static: false}) tabs!: IonTabs;
  selectedTab: any;
  username: string = '';
  email: string = '';
  avatar: string = '';
  name: string = '';
  userId: string = '';

  constructor(private storage: StorageService, private platform: Platform, private alertController: AlertController) { }

  ngOnInit() {
    this.storage.user$.subscribe(user => {
      if (user) {
        this.userId = user._id;
        this.username = user.username || '';
        this.email = user.email || '';
        this.avatar = user.profileImageUrl || '';
        this.name = user.displayName || '';
      }
    });
  }

  async openScanner() {
    if (this.platform.is('android') || this.platform.is('ios')) {
      const permissions = await Camera.checkPermissions();
      if (permissions.camera === 'granted') {
        this.startScan();
      } else if (permissions.camera === 'denied') {
        const alert = await this.alertController.create({
          header: 'Camera Permission Denied',
          message: 'Camera access is required to scan QR codes. Please enable it in your device settings.',
          htmlAttributes: { dir: 'ltr' },
          cssClass: "custom-Alert-single",
          buttons: [
            {
              text: 'OK',
              cssClass: 'alert-button alert-button-confirm',
              role: 'cancel',
              handler: () => console.log('🚫 المستخدم اختار عدم مشاهدة الإعلان'),
            },
          ]
        });
        await alert.present();
      } else {
        const requestPermissions = await Camera.requestPermissions();
        if (requestPermissions.camera === 'granted') {
          this.startScan();
        } else {
          const alert = await this.alertController.create({
            header: 'Camera Permission Denied',
            message: 'Camera access is required to scan QR codes. Please enable it in your device settings.',
            htmlAttributes: { dir: 'rtl' },
            cssClass: "custom-Alert-single",
            buttons: [
              {
                text: 'OK',
                role: 'confirm',
                handler: () => console.log('🚫 المستخدم اختار عدم مشاهدة الإعلان'),
              },
            ]
          });
          await alert.present();
        }
      }
    }
  }

  startScan() {
    CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      scanInstructions: 'Scan Device',
      scanText: 'Scan The QR Code'
    }).then(response => {
      let result = response.ScanResult;
      console.log(result);
    });
  }

  setCurrentTab() {
    this.selectedTab = this.tabs.getSelected();
    console.log(this.selectedTab);
  }
}
