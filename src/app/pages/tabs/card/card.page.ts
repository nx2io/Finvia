import { Component, OnInit, AfterContentChecked, AfterViewInit } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
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
  imports: [IonicModule, CommonModule, FormsModule, SwiperModule]
})


export class CardPage implements OnInit, AfterContentChecked, AfterViewInit {
  bannerConfig: SwiperOptions = {};
  cards: any[] = [];

  constructor() { }

  async ngOnInit() {
    await this.setStatusBarStyle();
    this.cards = [
      { id: 1, company_img: 'assets/imgs/mastercard.png', card_no: '5786 8945 9098 1100', card_holder: 'Nikhil Ag.', exp_date: '08/24' },
      { id: 2, company_img: 'assets/imgs/visa.png', card_no: '2006 7091 2014 8766', card_holder: 'Nikhil Ag.', exp_date: '11/29' },
      { id: 3, company_img: 'assets/imgs/mastercard.png', card_no: '4016 3081 2056 7890', card_holder: 'Nikhil Ag.', exp_date: '06/25' }
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
      centeredSlides: true,
      spaceBetween: 40,
      pagination: { clickable: true }
    };
  }

}

