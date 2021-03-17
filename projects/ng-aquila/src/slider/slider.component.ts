import { Direction, Directionality } from '@angular/cdk/bidi';
import { clamp } from '@aposin/ng-aquila/utils';
import { coerceBooleanProperty, coerceNumberProperty, BooleanInput, NumberInput } from '@angular/cdk/coercion';
import { DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW, UP_ARROW } from '@angular/cdk/keycodes';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  OnDestroy,
  Optional,
  Output,
  ViewChild,
  NgZone,
  AfterViewInit
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Decimal } from 'decimal.js';
import { fromEvent, Subscription } from 'rxjs';
import { FocusMonitor } from '@angular/cdk/a11y';

interface Position {
  x: number;
  y: number;
}

enum EventType {
  TOUCH, MOUSE
}

let nextId = 0;

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;
const DEFAULT_STEP = 1;

@Component({
  selector: 'nx-slider',
  templateUrl: './slider.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: [ './slider.component.scss' ],
  providers: [ {
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => NxSliderComponent),
    multi: true
  } ],
  host: {
    '[attr.aria-disabled]': 'disabled ? true : null',
    '(keydown)': 'handleKeypress($event)',
    '[class.nx-slider--disabled]': 'disabled',
    '[class.nx-slider--negative]': 'negative'
  }
})
export class NxSliderComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {

  /** @docs-private */
  @ViewChild('handle', { static: true }) handleElement: ElementRef;

  private _id: string = `nx-slider-${nextId++}`;
  /** Sets the id of the slider. */
  @Input('id')
  set id(value: string) {
    if (this._id !== value) {
      this._id = value;
      this._changeDetectorRef.markForCheck();
    }
  }
  get id(): string {
    return this._id;
  }

  private _tabIndex: number = 0;
  /** Sets the tabindex of the slider. */
  @Input()
  set tabindex(value: number) {
    this._tabIndex = coerceNumberProperty(value);
    this._changeDetectorRef.markForCheck();
  }
  get tabindex(): number {
    return this._disabled ? -1 : this._tabIndex;
  }

  private _min: number = DEFAULT_MIN;
  /** Sets the minimum value (Default: 0). */
  @Input('nxMin')
  set min(value: number) {
    this._min = coerceNumberProperty(value);
    this._changeDetectorRef.markForCheck();
  }
  get min(): number {
    return this._min;
  }

  private _max: number = DEFAULT_MAX;
  /** Sets the maximum value (Default: 100). */
  @Input('nxMax')
  set max(value: number) {
    this._max = coerceNumberProperty(value);
    this._changeDetectorRef.markForCheck();
  }
  get max(): number {
    return this._max;
  }

  /** Sets the step size by which the value of the slider can be increased or decreased (Default: 1). */
  @Input('nxStep')
  get step(): number { return this._step; }
  set step(value: number) {
    this._step = coerceNumberProperty(value, this._step);

    if (this._step % 1 !== 0) {
      this._roundToDecimal = this._step.toString().split('.').pop().length;
    }
  }

  private _label: string;
  /** Sets the label which is displayed on top of the slider. */
  @Input('nxLabel')
  set label(value: string) {
    if (this._label !== value) {
      this._label = value;
      this._changeDetectorRef.markForCheck();
    }
  }
  get label(): string {
    return this._label;
  }

  private _disabled: boolean = false;
  /** Whether the input to the control of the slider should be disabled. */
  @Input()
  set disabled(value: boolean) {
    this._disabled = coerceBooleanProperty(value);
    this._changeDetectorRef.markForCheck();
  }
  get disabled(): boolean {
    return this._disabled;
  }

  private _inverted: boolean = false;
  /** Whether the max value is to the right (false) or left (true).*/
  @Input('nxInverted')
  set inverted(value: boolean) {
    this._inverted = coerceBooleanProperty(value);
    this._changeDetectorRef.markForCheck();
  }
  get inverted(): boolean {
    return this._inverted;
  }

  private _thumbLabel: boolean = true;
  /** Whether to display the thumb label on top of the slider.*/
  @Input()
  set thumbLabel(value: boolean) {
    this._thumbLabel = coerceBooleanProperty(value);
    this._changeDetectorRef.markForCheck();
  }
  get thumbLabel(): boolean {
    return this._thumbLabel;
  }

  private _minMaxLabels: boolean = true;
  /** Whether to display the min & max labels below the slider.*/
  @Input()
  set minMaxLabels(value: boolean) {
    this._minMaxLabels = coerceBooleanProperty(value);
    this._changeDetectorRef.markForCheck();
  }
  get minMaxLabels(): boolean {
    return this._minMaxLabels;
  }

  private _negative: boolean = false;
  /** Whether the negative set of styles is applied (Default: 'false').*/
  @Input('negative')
  set negative(value: boolean) {
    this._negative = coerceBooleanProperty(value);
    this._changeDetectorRef.markForCheck();
  }
  get negative(): boolean {
    return this._negative;
  }

  /** An event is dispatched on each value change. */
  @Output('nxValueChange') valueChange: EventEmitter<number> = new EventEmitter<number>();

  private isActive = false;
  private dragSubscriptions: Subscription[] = [];
  private frameId: number;
  private position: Position = null;
  private _value: number = 0;
  private _roundToDecimal: number;
  private _step: number = DEFAULT_STEP;
  private _currentValue: number = 0;

  private _onChange: (value: any) => void = () => {};
  private _onTouched: () => any = () => {};

  /** Sets the customization function for the value which is displayed above the slider handle (Default:(value) => value). ). */
  @Input('nxValueFormatter') valueFormatter: Function = (value) => value;
  /** Sets the customization function for the label on the min-side of the slider (Default:(value) => value). */
  @Input('nxLabelMinFormatter') labelMinFormatter: Function = (value) => value;
  /** Sets the customization function for the label on the max-side of the slider (Default:(value) => value). */
  @Input('nxLabelMaxFormatter') labelMaxFormatter: Function = (value) => value;

  constructor(private elementRef: ElementRef,
              private _changeDetectorRef: ChangeDetectorRef,
              private _ngZone: NgZone,
              @Optional() private _dir: Directionality,
              private _focusMonitor: FocusMonitor) {
  }

  ngAfterViewInit() {
    this._focusMonitor.monitor(this.handleElement);
  }

  /** Sets the current value of the slider. */
  @Input('nxValue')
  set value(value: number) {
    this.writeValue(Number(value));
  }

  get value(): number {
    return this._value;
  }

  ngOnDestroy() {
    this.reset();
    this._focusMonitor.stopMonitoring(this.handleElement);
  }

  writeValue(value: number): void {
    if (value !== this._value) {
      this._value = value;
      this.valueChange.emit(value);
      this._changeDetectorRef.markForCheck();
    }
  }

  registerOnChange(fn: (value: any) => void) {
    this._onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  /** @docs-private */
  isMinimum() {
    return this._value === this.min;
  }

  /** @docs-private
   * A valid step is either:
   * - the minimum because thats our anchor for all value evaluation and steps
   * - (_value - min) % step === 0
   */
  isValidStep() {
    const safeValue = new Decimal(this._value).minus(this.min);
    const modulo = safeValue.mod(this.step);
    return this.isMinimum() || modulo.cmp(0) === 0;
  }

  /** @docs-private
   * We have to look at two cases:
   * - current value is a valid multitude of the step size
   *   then we can safely add or subtract the step
   * - the value is not a valid multitude. this could be the max value or the value bound
   *   via nxValue
   *   then we look for the next closest value upwards or downwards
   *   decimal.js provides a nice utility function for this.
   */
  changeValue(valueDiff: number): void {
    let newValue = new Decimal(this._value);
    if (this.isValidStep()) {
      newValue = newValue.plus(valueDiff);
    } else {
      // subtract the minimum to find the closest multitude then add the minimum again to get the valid slider step
      const minAdjustedValue = new Decimal(this._value).minus(this.min);
      newValue = valueDiff < 0 ? minAdjustedValue.toNearest(this.step, Decimal.ROUND_DOWN)
                  : minAdjustedValue.toNearest(this.step, Decimal.ROUND_UP);
      newValue = newValue.plus(this.min);
    }
    // cast the Decimal object to a JS number before it gets returned
    let toNumber = newValue.toNumber();
    toNumber = clamp(toNumber, this.min, this.max);
    if (this.value !== toNumber) {
      this._onChange(toNumber);
      this.valueChange.emit(toNumber);
      this.value = toNumber;
    }
  }

  /** @docs-private */
  get percentageValue(): number {
    let percentageValue = ((this.value || 0) - this.min) / (this.max - this.min) * 100;
    if (this.inverted) {
      percentageValue = 100 - percentageValue;
    }
    return clamp(percentageValue, 0, 100);
  }

  /** @docs-private */
  sliderClick(event: MouseEvent): void {
    if (this.disabled) {
      return;
    }

    this._focusHandleElement();
    event.stopPropagation();

    this.position = this.getPositionFromEvent(event);
    this.frameId = requestAnimationFrame(() => {
      this.valueByPosition();
      if (this.value !== this._currentValue) {
        this._currentValue = this.value;
        this._onChange(this.value);
      }
    });
  }

  /** @docs-private */
  focus(): void {
    if (this.disabled) {
      return;
    }
    this._focusHandleElement();
  }

  /** @docs-private */
  blur(): void {
    if (this.disabled) {
      return;
    }
  }

  /**
   * @docs-private
   * Prevent text selection when dragging the handle.
   */
  selectStart() {
    return false;
  }

  /** @docs-private */
  handleKeypress(event: KeyboardEvent) {
    if (this.disabled) {
      return;
    }

    if (event.which < LEFT_ARROW || event.which > DOWN_ARROW) {
      return;
    }

    switch (event.which) {
      case this.inverted ? RIGHT_ARROW : LEFT_ARROW :
      case DOWN_ARROW:
        return this.changeValue(-this.step);

      case UP_ARROW:
      case this.inverted ? LEFT_ARROW : RIGHT_ARROW :
        return this.changeValue(this.step);
    }
  }

  /** @docs-private
   * this is called on mousedown or touchstart
   */
  dragStart(event: MouseEvent | TouchEvent): void {
    if (this.disabled) {
      return;
    }

    this.isActive = true;
    const isTouchEvent = this.detectEventType(event) === EventType.TOUCH;
    this._currentValue = this.value;

    if (isTouchEvent) {
      this._ngZone.runOutsideAngular(() => {
        this.dragSubscriptions.push(fromEvent(document, 'touchmove').subscribe(this.handleDragMove.bind(this)));
        this.dragSubscriptions.push(fromEvent(document, 'touchend').subscribe(this.handleDragStop.bind(this)));
      });
      this._ngZone.run(() => {
        this.dragSubscriptions.push(fromEvent(document, 'touchcancel').subscribe(this.handleDragStop.bind(this)));
      });
    } else {
      this._ngZone.runOutsideAngular(() => {
        this.dragSubscriptions.push(fromEvent(document, 'mousemove').subscribe(this.handleDragMove.bind(this)));
      });
      this._ngZone.run(() => {
        this.dragSubscriptions.push(fromEvent(document, 'mouseup').subscribe(this.handleDragStop.bind(this)));
      });
    }

    this.position = this.getPositionFromEvent(event);

    this.runChangeObserver();
  }

  /** @docs-private */
  formatValue(value: number): string {
    return this.valueFormatter(value);
  }

  /** @docs-private */
  formatLabelLeft(): string {
    return this.inverted ? this.formatLabelMax() : this.formatLabelMin();
  }

  /** @docs-private */
  formatLabelRight(): string {
    return this.inverted ? this.formatLabelMin() : this.formatLabelMax();
  }

  /** @docs-private */
  valueByPosition(): void {
    const isRTL = this._dir && this._dir.value === 'rtl';
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const x = Math.max(rect.left, Math.min(rect.right, this.position.x));

    // position of slider relative to slider width
    let percent = (x - rect.left) / rect.width;
    if (this.inverted) {
      percent = 1 - percent;
    }
    if (isRTL) {
      percent = 1 - percent;
    }
    const exactValue = this.min + percent * (this.max - this.min);
    /**
     * edge case handling because of float precision errors
     * you couldn't reach the maximum
     */
    let closestValue;
    if (percent === 1) {
      closestValue = this.max;
    } else if (percent === 0) {
      closestValue = this.min;
    } else {
      closestValue = Math.round((exactValue - this.min) / this.step) * this.step + this.min;
    }
    if (this._roundToDecimal) {
      closestValue = this.roundToDecimal(closestValue);
    }

    closestValue = clamp(closestValue, this.min, this.max);

    this.value = closestValue;
  }

  /** @docs-private */
  roundToDecimal(value: number) {
    return parseFloat(value.toFixed(this._roundToDecimal));
  }

  /** @docs-private */
  formatLabelMin() {
    return this.labelMinFormatter(this.min);
  }

  /** @docs-private */
  formatLabelMax() {
    return this.labelMaxFormatter(this.max);
  }

  private handleDragMove(event: MouseEvent | TouchEvent): void {
    this.position = this.getPositionFromEvent(event);
  }

  private handleDragStop(event: MouseEvent | TouchEvent): void {
    this.reset();
    this.valueByPosition();
    if (this.value !== this._currentValue) {
      this._currentValue = this.value;
      this._onChange(this.value);
    }
  }

  private runChangeObserver(): void {
    this.frameId = requestAnimationFrame(() => {
      this.valueByPosition();

      if (this.isActive) {
        this.runChangeObserver();
      }
    });
  }

  private reset(): void {
    this.isActive = false;

    for (const subscription of this.dragSubscriptions) {
      subscription.unsubscribe();
    }

    this.dragSubscriptions = [];
    cancelAnimationFrame(this.frameId);
  }

  private detectEventType(event): EventType {
    return event.type.includes('touch') ? EventType.TOUCH : EventType.MOUSE;
  }

  private getPositionFromEvent(event: MouseEvent | TouchEvent): Position {
    const eventType = this.detectEventType(event);
    const cursor: any = eventType === EventType.TOUCH ? (event as TouchEvent).touches.item(0) : event;
    return {
      x: cursor.clientX,
      y: cursor.clientY
    };
  }

  /** @docs-private */
  _focusHandleElement() {
    this.handleElement.nativeElement.focus();
  }

  static ngAcceptInputType_tabindex: NumberInput;
  static ngAcceptInputType_min: NumberInput;
  static ngAcceptInputType_max: NumberInput;
  static ngAcceptInputType_step: NumberInput;
  static ngAcceptInputType_disabled: BooleanInput;
  static ngAcceptInputType_inverted: BooleanInput;
  static ngAcceptInputType_thumbLabel: BooleanInput;
  static ngAcceptInputType_minMaxLabels: BooleanInput;
  static ngAcceptInputType_negative: BooleanInput;
  static ngAcceptInputType_value: NumberInput;
}
