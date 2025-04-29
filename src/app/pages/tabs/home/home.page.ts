import { AfterContentChecked, Component, OnInit, AfterViewInit } from '@angular/core';
import SwiperCore, { SwiperOptions, Pagination } from 'swiper';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SwiperModule } from 'swiper/angular'; // Import SwiperModule

import { StatusBar, Style } from '@capacitor/status-bar';
// install Swiper modules
// SwiperCore.use([Pagination]);

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [ IonicModule, CommonModule, FormsModule, SwiperModule, RouterModule] // Add SwiperModule to imports
})
export class HomePage implements OnInit, AfterContentChecked, AfterViewInit {
  accounts: any[] = [];
  bannerConfig: SwiperOptions = {}; // Initialize bannerConfig
  featureConfig: SwiperOptions = {}; // Initialize featureConfig
  features: any[] = [];
  transactions: any[] = [];

  constructor() { }

  async ngOnInit() {
    await this.setStatusBarStyle();
    this.accounts = [
      { id: 1, acc_no: '57868945098', balance: '200000', currency: 'USD' },
      { id: 2, acc_no: '20067091201', balance: '50000', currency: 'INR' },
      { id: 3, acc_no: '40163081205', balance: '80000', currency: 'SAR' }
    ];
    this.features = [
      { id: 1, color: 'success', icon: 'icon-[solar--wallet-money-linear]', name: 'Top-up' },
      { id: 2, color: 'tertiary', icon: 'icon-[hugeicons--money-send-circle]', name: 'Send' },
      { id: 3, color: 'white', icon: 'icon-[hugeicons--money-receive-circle]', name: 'Request' },
      { id: 4, color: 'light', icon: 'icon-[hugeicons--bank]', name: 'Withdrawal' },
      // { id: 4, color: 'light', icon: 'icon-[solar--bill-list-line-duotone]', name: 'Bills' },
      // { id: 5, color: 'warning', icon: 'icon-[solar--card-2-line-duotone]', name: 'Cards' },
    ];
    this.transactions = [
      { id: 1, to: 'Piyush Ag.', date: '2022-05-22', amount: 5000 },
      { id: 2, to: 'Avinash', date: '2022-03-02', amount: 7000 },
      { id: 3, to: 'Catherine', date: '2022-07-28', amount: -3250 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1000 },
      { id: 5, to: 'Prem Ag.', date: '2022-04-13', amount: -800 },
      { id: 5, to: 'Piyush Ag.', date: '2022-04-13', amount: 800 },
      { id: 5, to: 'Avinash', date: '2022-04-13', amount: -600 },
      { id: 5, to: 'Catherine', date: '2022-04-13', amount: 1500 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1900 },
    ];
  }

  async ngAfterViewInit() {
    await this.setStatusBarStyle();
  }

  private async setStatusBarStyle() {
    await StatusBar.setStyle({ style: Style.Dark });
  }

  ngAfterContentChecked() {
    this.bannerConfig = {
      slidesPerView: 1,
      // pagination: { clickable: true }
    };
    this.featureConfig = {
      slidesPerView: 3.5,
    };
  }

}
