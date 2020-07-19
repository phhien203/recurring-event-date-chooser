import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {NgbCalendar, NgbDate, NgbDateParserFormatter} from '@ng-bootstrap/ng-bootstrap';
import {Frequency, Options, RRule} from 'rrule';
import {Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

export function toNativeDate(ngbDate: NgbDate): Date {
  return new Date(Date.UTC(ngbDate.year, ngbDate.month - 1, ngbDate.day));
}

@Component({
  selector: 'app-recurring-event-chooser',
  templateUrl: './recurring-event-picker.component.html',
  styleUrls: ['./recurring-event-picker.component.scss']
})
export class RecurringEventPickerComponent implements OnInit, OnDestroy {
  Frequency = Frequency;
  recurringForm: FormGroup;
  hoveredDate: NgbDate | null = null;
  dates: Date[] = [];

  private today: NgbDate;
  private weekdayMap = [
    RRule.MO,
    RRule.TU,
    RRule.WE,
    RRule.TH,
    RRule.FR,
    RRule.SA,
    RRule.SU
  ];
  private destroy$ = new Subject();

  get f(): any {
    return this.recurringForm.controls;
  }

  constructor(
    private fb: FormBuilder,
    private calendar: NgbCalendar,
    public formatter: NgbDateParserFormatter
  ) { }

  ngOnInit(): void {
    this.today = this.calendar.getToday();
    this.initRecurringForm();
    this.subscribeToFormValue();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onDateSelection(date: NgbDate): void {
    if (!this.f.startDate.value && !this.f.endDate.value) {
      this.f.startDate.setValue(date);
    } else if (this.f.startDate.value && !this.f.endDate.value && date && date.after(this.f.startDate.value)) {
      this.f.endDate.setValue(date);
    } else {
      this.f.endDate.setValue(null);
      this.f.startDate.setValue(date);
    }
  }

  isHovered(date: NgbDate): boolean {
    return this.f.startDate.value &&
      !this.f.endDate.value &&
      this.hoveredDate &&
      date.after(this.f.startDate.value) &&
      date.before(this.hoveredDate);
  }

  isInside(date: NgbDate): boolean {
    return this.f.endDate.value && date.after(this.f.startDate.value) && date.before(this.f.endDate.value);
  }

  isRange(date: NgbDate): boolean {
    return date.equals(this.f.startDate.value) ||
      (this.f.endDate.value && date.equals(this.f.endDate.value)) ||
      this.isInside(date) || this.isHovered(date);
  }

  validateInput(currentValue: NgbDate | null, input: string): NgbDate | null {
    const parsed = this.formatter.parse(input);
    return parsed && this.calendar.isValid(NgbDate.from(parsed)) ? NgbDate.from(parsed) : currentValue;
  }

  setStartDate(value: string): void {
    this.f.startDate.setValue(this.validateInput(this.f.startDate.value, value));
  }

  setEndDate(value: string): void {
    this.f.endDate.setValue(this.validateInput(this.f.endDate.value, value));
  }

  private initRecurringForm(): void {
    this.recurringForm = this.fb.group({
      startDate: [this.today, Validators.required],
      endDate: [this.calendar.getNext(this.today, 'd', 7), Validators.required],
      frequency: [Frequency.DAILY],
      onWeekday: this.fb.array(
        [false, false, false, false, false, false, false].map(val => this.fb.control(val))
      ),
      onMonthday: [this.today]
    });
  }

  private subscribeToFormValue(): void {
    this.recurringForm.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe((value) => {
      const options: Partial<Options> = {
        freq: value.frequency || Frequency.DAILY,
        dtstart: toNativeDate(value.startDate || this.today),
        until: toNativeDate(value.endDate || this.today),
        byweekday: value.frequency === Frequency.WEEKLY ?
          this.getWeekday(value.onWeekday) : null,
        bymonthday: value.frequency === Frequency.MONTHLY ?
          (value.onMonthday && value.onMonthday.day || this.today.day) : null
      };
      console.log('options', options);
      const rule = new RRule(options);
      this.dates = rule.all();
    });

    this.recurringForm.patchValue({
      startDate: this.today,
      endDate: this.calendar.getNext(this.today, 'd', 7),
      frequency: Frequency.DAILY
    });
  }

  private getWeekday(byWeekday: boolean[]): any {
    const result = byWeekday
      .map((v, i) => v && this.weekdayMap[i] || null)
      .filter(v => !!v);
    return result.length ? result : null;
  }
}
