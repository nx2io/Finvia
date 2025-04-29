import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { StatusBar, Style } from '@capacitor/status-bar';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class SettingsPage implements OnInit, AfterViewInit {

  constructor() { }

  async ngOnInit() {
    await this.setStatusBarStyle()
  }
  async ngAfterViewInit() {
    await this.setStatusBarStyle();
  }

  private async setStatusBarStyle() {
    await StatusBar.setStyle({ style: Style.Dark });
  }

}
