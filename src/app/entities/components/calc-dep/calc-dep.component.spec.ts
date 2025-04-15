import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalcDepComponent } from './calc-dep.component';

describe('CalcDepComponent', () => {
  let component: CalcDepComponent;
  let fixture: ComponentFixture<CalcDepComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CalcDepComponent]
    });
    fixture = TestBed.createComponent(CalcDepComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
