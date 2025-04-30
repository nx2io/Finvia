import { Component, OnInit, AfterContentChecked, AfterViewInit } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonLabel, IonToolbar, IonList, IonItemGroup, IonItem, IonTitle, IonRow, IonImg, IonText, IonListHeader, IonToggle } from '@ionic/angular/standalone';
import SwiperCore, { SwiperOptions, Pagination } from 'swiper';
import { SwiperModule } from 'swiper/angular'; // Import SwiperModule

import { StatusBar, Style } from '@capacitor/status-bar';
// install Swiper modules
SwiperCore.use([Pagination]);

@Component({
  selector: 'app-cards',
  templateUrl: './card.page.html',
  styleUrls: ['./card.page.scss'],
  standalone: true,
  imports: [IonToggle, IonListHeader, IonText, IonImg, IonRow, IonContent, IonLabel, IonToolbar, IonList, IonItemGroup, IonItem, IonTitle, CommonModule, FormsModule, SwiperModule]
})


export class CardPage implements OnInit, AfterContentChecked, AfterViewInit {
  bannerConfig: SwiperOptions = {};
  cards: any[] = [];

  constructor() { }

  async ngOnInit() {
    // await this.setStatusBarStyle();
    this.cards = [
      { id: 1, company_img: 'https://kuraimibank.com/media/6350/%D8%A7%D9%84%D8%B4%D8%B9%D8%A7%D8%B1-(1).png', currency: "YER", card_no: '5585466923', card_holder: 'Abdullah M Abdullah Al-agi', exp_date: '08/24' },
      { id: 2, company_img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Saudi_National_Bank_Logo.svg/2560px-Saudi_National_Bank_Logo.svg.png', card_no: '45184678455000157', currency: "SAR", card_holder: 'Abdullah M Abdullah Al-agi', exp_date: '11/29' },
      { id: 3, company_img: 'https://d1io3yog0oux5.cloudfront.net/_49ea7e52c1c7ef5c74e7d64c6babd371/bankofamerica/logo.png', card_no: '4016308120567890', currency: "USD", card_holder: 'Abdullah M Abdullah Al-agi', exp_date: '06/25' }
    ];
  }

  async ngAfterViewInit() {
    // await this.setStatusBarStyle();
  }

  // private async setStatusBarStyle() {
  //   await StatusBar.setStyle({ style: Style.Dark });
  // }

  ngAfterContentChecked() {
    this.bannerConfig = {
      slidesPerView: 1,
      centeredSlides: true,
      spaceBetween: 40,
      pagination: { clickable: true }
    };
  }

}

