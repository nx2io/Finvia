import { ComponentFixture, TestBed } from '@angular/core/testing';
import { history} from './history

describe('historyPage', () => {
  let component: historyPage;
  let fixture: ComponentFixture<historyPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(historyPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
