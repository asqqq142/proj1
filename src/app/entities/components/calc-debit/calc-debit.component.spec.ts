import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalcDebitComponent } from './calc-debit.component';

describe('CalcDebitComponent', () => {
  let component: CalcDebitComponent;
  let fixture: ComponentFixture<CalcDebitComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CalcDebitComponent]
    });
    fixture = TestBed.createComponent(CalcDebitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
