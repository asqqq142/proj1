import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompareDebitComponent } from './compare-debit.component';

describe('CompareDebitComponent', () => {
  let component: CompareDebitComponent;
  let fixture: ComponentFixture<CompareDebitComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CompareDebitComponent]
    });
    fixture = TestBed.createComponent(CompareDebitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
