import { ErrorStateMatcher } from '@aposin/ng-aquila/utils';
import { Direction, Directionality } from '@angular/cdk/bidi';
import { coerceBooleanProperty, BooleanInput } from '@angular/cdk/coercion';
import { NxFormfieldComponent, NxFormfieldControl } from '@aposin/ng-aquila/formfield';
import { ActiveDescendantKeyManager } from '@angular/cdk/a11y';
import { SelectionModel } from '@angular/cdk/collections';
import { DOWN_ARROW, END, ENTER, HOME, LEFT_ARROW, RIGHT_ARROW, SPACE, UP_ARROW, SHIFT, TAB } from '@angular/cdk/keycodes';
import { CdkConnectedOverlay, ConnectionPositionPair, FlexibleConnectedPositionStrategy } from '@angular/cdk/overlay';
import {
  AfterContentInit,
  Attribute,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChildren,
  DoCheck,
  ElementRef,
  EventEmitter,
  Input,
  isDevMode,
  NgZone,
  OnDestroy,
  OnInit,
  Optional,
  Output,
  Self,
  ViewChild,
  TemplateRef,
  ContentChild,
} from '@angular/core';
import { ControlValueAccessor, FormControl, FormGroupDirective, NgControl, NgForm } from '@angular/forms';
import { defer, merge, Observable, Subject } from 'rxjs';
import {delay, filter, map, startWith, switchMap, take, takeUntil} from 'rxjs/operators';

import { getNxDropdownNonArrayValueError, getNxDropdownNonFunctionValueError } from './dropdown-errors';
import { NxDropdownControl } from './dropdown.control';
import { NxDropdownGroupComponent } from './group/dropdown-group';
import { NxDropdownItemChange, NxDropdownItemComponent } from './item/dropdown-item';
import { NxDropdownClosedLabelDirective } from './closed-label.directive';

let nextUniqueId = 0;

/** Change event object that is emitted when the select value has changed. */
export class NxDropdownSelectChange<T = any> {
  constructor(
    /** Reference to the select that emitted the change event. */
    public source: NxDropdownComponent,
    /** Current value of the select that emitted the event. */
    public value: T) { }
}

function getPositions(): ConnectionPositionPair[] {
  return [{
    originX: 'start',
    originY: 'top',
    overlayX: 'start',
    overlayY: 'top'
  }, {
    originX: 'start',
    originY: 'center',
    overlayX: 'start',
    overlayY: 'center'
  }, {
    originX: 'start',
    originY: 'bottom',
    overlayX: 'start',
    overlayY: 'bottom'
  }];
}
@Component({
  selector: 'nx-dropdown',
  templateUrl: 'dropdown.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['dropdown.scss'],
  providers: [
    { provide: NxDropdownControl, useExisting: NxDropdownComponent },
    { provide: NxFormfieldControl, useExisting: NxDropdownComponent },
  ],
  host: {
    'role': 'button',
    '[class.nx-dropdown]': 'true',
    '[class.is-filled]': 'hasValue',
    '[class.has-focus]': 'focused',
    '[class.nx-dropdown--negative]': '_negative',
    '[class.nx-dropdown--disabled]': 'disabled',
    '[attr.aria-describedby]': 'ariaDescribedby || null',
    '[attr.aria-required]': 'required',
    '[attr.aria-disabled]': 'disabled',
    '[attr.aria-labelledby]': '_getAriaLabelledBy()',
    'aria-haspopup': 'listbox',
    '[attr.aria-expanded]': 'panelOpen',
    '[attr.disabled]': 'disabled || null',
    '[attr.tabindex]': 'tabIndex',
    '(keydown)': '_handleKeydown($event)',
    '(focus)': '_onFocus()',
    '(blur)': '_onBlur()',
    '(click)': 'openPanel()'
  }
})
export class NxDropdownComponent implements NxDropdownControl, ControlValueAccessor,
  OnInit, AfterContentInit, OnDestroy, DoCheck {

  // The dropdown currently doesn't support readonly of the NxFormfieldControl so we hardcode it here
  readonly readonly: boolean = false;

  private _selectionModel: SelectionModel<NxDropdownItemComponent>;

  protected _disabled: boolean = false;

  /** The ID of rendered dropdown html element. */
  readonly renderedValueId: string = `nx-dropdown-rendered-${nextUniqueId++}`;

  private _placeholder: string;

  private _focused: boolean = false;

  /** Whether or not the overlay panel is open. */
  private _panelOpen = false;

  /** @docs-private */
  errorState: boolean = false;

  /** @docs-private */
  isStable: boolean = false;

  /**
   * Name of this control that is used inside the formfield component
   * @docs-private
   */
  controlType = 'nx-dropdown';

  /** Holds the value from nxValue. */
  private _value: any;

  /** The minimal space between the viewport and the overlay */
  _overlayViewportMargin: number = this.dir === 'rtl' ? 0 : 16;

  /** The last measured value for the trigger's client bounding rect. */
  _triggerRect: ClientRect;

  /** Holds the panelWidth after panel was attached. */
  _panelWidth: number;

  /**
   * @docs-private
   * Emits when internal state changes to inform formfield about it.
   */
  readonly stateChanges = new Subject<any>();

  /** The IDs of child options to be passed to the aria-owns attribute. */
  _optionIds: string = '';

  /** @docs-private */
  ariaDescribedby: string;

  private _tabIndex: number = 0;

  /** @docs-private */
  currentFilter: string = '';

  @Input()
  get tabIndex(): number { return this.disabled ? -1 : this._tabIndex; }
  set tabIndex(value: number) {
    // If the specified tabIndex value is null or undefined, fall back to the default value.
    this._tabIndex = value != null ? value : 0;
  }

  /** Selected value */
  @Input('nxValue')
  get value(): any { return this._value; }
  set value(newValue: any) {
    if (newValue !== this._value) {
      this.writeValue(newValue);
      this._value = newValue;
      this._onChange(newValue);
    }
  }

  /** Whether the dropdown is disabled. */
  @Input('nxDisabled')
  get disabled() {
    return this._disabled;
  }
  set disabled(value: boolean) {
    this._disabled = coerceBooleanProperty(value);
  }

  /**
   * Whether the dropdown should allow multi selection and additional checkboxes are shown.
   *
   * Note: Please make sure the value you bind is an array. If not an error is thrown! */
  @Input('nxIsMultiselect') isMultiSelect: boolean = false;

  /** The id of the input. */
  get id() {
    return this.renderedValueId;
  }

  /** Whether the component is required. This adds an aria-required label to the component. */
  @Input('nxRequired') required: boolean;

  private _style: string = '';
  /** Whether the dropdown should render in its negative style or not. */
  _negative: boolean = false;

  /** If set to 'negative', the component is displayed with the negative set of styles. */
  @Input('nxStyle')
  set styles(value: string) {

    if (this._style === value) {
      return;
    }

    this._style = value;
    this._negative = !!this._style.match(/negative/);
  }

    /** Placeholder to be shown if no value has been selected. */
    @Input()
    get placeholder(): string { return this._placeholder; }
    set placeholder(value: string) {
      this._placeholder = value;
      this.stateChanges.next();
    }

  /** Whether the dropdown should be shown with an additional filter input. */
  @Input('nxShowFilter') showFilter: boolean = false;

  /** Text displayed as placeholder for the filter. */
  @Input('nxFilterPlaceholder') filterPlaceholder: string = '';

  /** Event emitted when the select panel has been toggled. */
  @Output() readonly openedChange: EventEmitter<boolean> = new EventEmitter<boolean>();

  /** Event emitted when the dropdown items get filtered. Returns the currently visible dropdown items. */
  @Output('filterResult') readonly filterResultChange: EventEmitter<NxDropdownItemComponent[]>
  = new EventEmitter<NxDropdownItemComponent[]>();

  /** Event emitted when the select has been opened. */
  @Output('opened') readonly _openedStream: Observable<void> =
    this.openedChange.pipe(filter(o => o), map(() => { }));

  /** Event emitted when the select has been closed. */
  @Output('closed') readonly _closedStream: Observable<void> =
    this.openedChange.pipe(filter(o => !o), map(() => { }));

  /** Event emitted when the user types in the filter input. */
  @Output('filterInput') readonly filterChanges: Subject<any> = new Subject<any>();
  /**
   * Event that emits whenever the raw value of the select changes. This is here primarily
   * to facilitate the two-way binding for the `value` input.
   * @docs-private
   */
  @Output('nxValueChange') readonly valueChange: EventEmitter<any> = new EventEmitter<any>();

  /** Event emitted when the selected value has been changed. */
  @Output() readonly selectionChange: EventEmitter<NxDropdownSelectChange> =
    new EventEmitter<NxDropdownSelectChange>();

  /** @docs-private */
  readonly optionSelectionChanges: Observable<NxDropdownItemChange> = defer<Observable<NxDropdownItemChange>>(() => {
    if (this.options) {
      return merge(...this.options.map(option => option.onSelectionChange));
    }

    return this._ngZone.onStable
      .asObservable()
      .pipe(take(1), switchMap(() => this.optionSelectionChanges));
  });

  /**
   * This position config ensures that the top "start" corner of the overlay
   * is aligned with with the top "start" of the origin by default (overlapping
   * the trigger completely). If the panel cannot fit below the trigger, it
   * will fall back to a position above the trigger.
   */
  _positions:  ConnectionPositionPair[];

  /**
   * @docs-private
   * Panel containing the select options.
   */
  @ViewChild('panel') panel: ElementRef;

  /** @docs-private */
  @ViewChild('panelBody') panelBody: ElementRef;

  /** @docs-private */
  @ViewChild('trigger', { static: true }) trigger: ElementRef;

  /** @docs-private */
  @ViewChild('filterInput') filterInput: ElementRef;

  /**
   * @docs-private
   * Overlay pane containing the options.
   */
  @ViewChild(CdkConnectedOverlay, { static: true }) overlayDir: CdkConnectedOverlay;

  /** @docs-private */
  @ContentChildren(NxDropdownItemComponent, { descendants: true }) options;

  /** @docs-private */
  @ContentChildren(NxDropdownGroupComponent) groups;

  @ContentChild(NxDropdownClosedLabelDirective)
  _customClosedDropdownLabel: NxDropdownClosedLabelDirective;

  @ViewChild('defaultClosedDropdownLabel', { static: true })
  private _defaultClosedDropdownLabel: TemplateRef<any>;

  /** @docs-private */
  get closedDropdownLabel(): TemplateRef<any> {
    return this._closedDropdownLabel;
  }
  private _closedDropdownLabel: TemplateRef<any>;

  /** Emits whenever the component is destroyed. */
  private readonly _destroy = new Subject<void>();

  /**
   * @docs-private
   * The currently selected option.
   */
  get selected(): NxDropdownItemComponent | NxDropdownItemComponent[] {
    return this.isMultiSelect ? this._selectionModel.selected : this._selectionModel.selected[0];
  }

  private _keyManager: ActiveDescendantKeyManager<NxDropdownItemComponent>;

  /** @docs-private */
  get panelOpen(): boolean {
    return this._panelOpen;
  }
  set panelOpen(value: boolean) {
    this._panelOpen = value;
  }

  /**
   * Function that transforms the value into a string.
   * This function is used for displaying and filtering the content
   * ( Default: (value) => value ? value.toString() : null; ).
   */
  @Input('nxValueFormatter') valueFormatter = (value) => {
    return value == null ? '' : value.toString();
  }

  /** @docs-private */
  get label(): string {
    return this.formFieldComponent ? this.formFieldComponent.label : '';
  }

  /** Comparison function to specify which option is displayed. Defaults to object equality. */
  private _compareWith = (o1: any, o2: any) => o1 === o2;

  /**
   * Function to compare the option values with the selected values. The first argument
   * is a value from an option. The second is a value from the selection. A boolean
   * should be returned.
   */
  @Input()
  get compareWith() { return this._compareWith; }
  set compareWith(fn: (o1: any, o2: any) => boolean) {
    if (typeof fn !== 'function') {
      throw getNxDropdownNonFunctionValueError();
    }
    this._compareWith = fn;
    if (this._selectionModel) {
      // A different comparator means the selection could change.
      this._initializeSelection();
    }
  }

  private _filterFn = (search: string, itemValue: string) => {
    return itemValue.toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) >= 0;
  }

  /**
   * Function to be used when the user types into the search filter. The first argument is the user input,
   * the second argument is the dropdown item value. The dropdown items will use this function to set their
   * visibility state.
   * A boolean should be returned.
   */
  @Input()
  get filterFn() { return this._filterFn; }
  set filterFn(fn: (search: string, itemValue: string) => boolean) {
    if (typeof fn !== 'function') {
      throw getNxDropdownNonFunctionValueError();
    }
    this._filterFn = fn;
  }

  /**
   * @docs-private
   * Whether the select is focused.
   */
  get focused(): boolean {
    return this._focused || this.panelOpen;
  }

  /** `View -> model callback called when value changes` */
  _onChange: (value: any) => void = () => { };

  /** `View -> model callback called when select has been touched` */
  _onTouched = () => { };

  /** @docs-private */
  get elementRef(): ElementRef {
    return this._elementRef;
  }

  /** The text direction of the containing app. */
  get dir(): Direction {
    return this._dir && this._dir.value === 'rtl' ? 'rtl' : 'ltr';
  }

  constructor(
    private _changeDetectorRef: ChangeDetectorRef,
    private _elementRef: ElementRef,
    private _ngZone: NgZone,
    @Attribute('tabindex') tabIndex: string,
    @Optional() private formFieldComponent: NxFormfieldComponent,
    private _errorStateMatcher: ErrorStateMatcher,
    /** @docs-private */
    @Self() @Optional() public ngControl: NgControl,
    @Optional() private _parentForm: NgForm,
    @Optional() private _parentFormGroup: FormGroupDirective,
    @Optional() private _dir: Directionality) {

    if (this.ngControl) {
      // Note: we provide the value accessor through here, instead of
      // the `providers` to avoid running into a circular import.
      this.ngControl.valueAccessor = this;
    }

    this._positions = getPositions();
    this.tabIndex = parseInt(tabIndex, 10) || 0;
  }

  ngDoCheck() {
    if (this.ngControl) {
      this.updateErrorState();
    }
  }

  ngOnInit() {
    this._selectionModel = new SelectionModel<NxDropdownItemComponent>(this.isMultiSelect);
  }

  ngAfterContentInit() {
    this._closedDropdownLabel =
      this._customClosedDropdownLabel && this._customClosedDropdownLabel.templateRef || this._defaultClosedDropdownLabel;
    this._initKeyManager();

    this._selectionModel.changed.pipe(takeUntil(this._destroy)).subscribe(event => {
      event.added.forEach(option => option.select());
      event.removed.forEach(option => option.deselect());
    });

    this.options.changes.pipe(startWith(null), takeUntil(this._destroy)).subscribe(() => {
      this._resetOptions();
      this._initializeSelection();
    });
  }

  ngOnDestroy() {
    this._destroy.next();
    this._destroy.complete();
  }

  /** @docs-private */
  updateErrorState() {
    const oldState = this.errorState;
    const parent = this._parentFormGroup || this._parentForm;
    const control = this.ngControl ? this.ngControl.control as FormControl : null;
    const newState = this._errorStateMatcher.isErrorState(control, parent);

    if (newState !== oldState) {
      this.errorState = newState;
      this.stateChanges.next();
    }
  }

  /** Sets up a key manager to listen to keyboard events on the overlay panel. */
  private _initKeyManager() {
    this._keyManager = new ActiveDescendantKeyManager<NxDropdownItemComponent>(this.options)
      .withTypeAhead()
      .withWrap()
      .withVerticalOrientation()
      .withHorizontalOrientation('ltr')
      .skipPredicate(item => item._hidden || item.disabled);

    this._keyManager.tabOut.pipe(takeUntil(this._destroy)).subscribe(() => {
      // Restore focus to the trigger before closing. Ensures that the focus
      // position won't be lost if the user got focus into the overlay.
      this.closePanel();
    });

    this._keyManager.change.pipe(takeUntil(this._destroy)).subscribe(() => {
      if (this._panelOpen && this.panel) {
        // Delay the auto scrolling until all items have settled otherwise the item containers might
        // not exist yet
        this._ngZone.onStable
          .asObservable()
          .pipe(take(1)).subscribe(() => {
            this._scrollActiveOptionIntoView();
          });
      } else if (!this._panelOpen && !this.isMultiSelect && this._keyManager.activeItem) {
        this._keyManager.activeItem._selectViaInteraction();
      }
    });
  }

  private _resetOptions(): void {
    const changedOrDestroyed = merge(this.options.changes, this._destroy);

    this.optionSelectionChanges.pipe(takeUntil(changedOrDestroyed)).subscribe(event => {
      this._onSelect(event.item, event.isUserInput);

      if (event.isUserInput && !this.isMultiSelect && this._panelOpen) {
        this.closePanel();
      }
    });

    // Listen to changes in the internal state of the options and react accordingly.
    // Handles cases like the labels of the selected options changing.
    merge(...this.options.map(option => option._stateChanges))
      .pipe(takeUntil(changedOrDestroyed))
      .subscribe(() => {
        // defer it for the next cycle to not run in changed after checked errors
        // the combination of dropdown-item notifying parent and when the parent
        // tries to fetch the triggerValue from the child throws these errors
        setTimeout(() => {
          this._changeDetectorRef.markForCheck();
          this.stateChanges.next();
        });
      });

    this._setOptionIds();
  }

  /** Records option IDs to pass to the aria-owns property. */
  private _setOptionIds() {
    this._optionIds = this.options.map(option => option.id).join(' ');
  }

  /** Invoked when an option is clicked. */
  private _onSelect(option: NxDropdownItemComponent, isUserInput: boolean): void {
    const wasSelected = this._selectionModel.isSelected(option);

    if (option.value == null && !this.isMultiSelect) {
      option.deselect();
      this._selectionModel.clear();
      this._propagateChanges(option.value);
    } else {
      option.selected ? this._selectionModel.select(option) : this._selectionModel.deselect(option);

      if (isUserInput) {
        this._keyManager.setActiveItem(option);
      }

      if (this.isMultiSelect) {
        this._sortValues();
      }
    }

    if (wasSelected !== this._selectionModel.isSelected(option)) {
      this._propagateChanges();
    }

    this.stateChanges.next();
  }

  private _initializeSelection(): void {
    // Defer setting the value in order to avoid the "Expression
    // has changed after it was checked" errors from Angular.
    Promise.resolve().then(() => {
      this._setSelectionByValue(this.ngControl ? this.ngControl.value : this._value);
    });
  }

  /**
   * Sets the selected option based on a value. If no option can be
   * found with the designated value, the select trigger is cleared.
   */
  private _setSelectionByValue(value: any | any[]): void {
    if (this.isMultiSelect && value) {
      if (!Array.isArray(value)) {
        throw getNxDropdownNonArrayValueError();
      }

      this._selectionModel.clear();
      value.forEach((currentValue: any) => this._selectValue(currentValue));
      this._sortValues();
    } else {
      this._selectionModel.clear();
      const correspondingOption = this._selectValue(value);
      // Shift focus to the active item. Note that we shouldn't do this in multiple
      // mode, because we don't know what option the user interacted with last.
      if (correspondingOption) {
        this._keyManager.setActiveItem(correspondingOption);
      }
    }

    this._changeDetectorRef.markForCheck();
  }

  /**
   * Finds and selects and option based on its value.
   * @returns Option that has the corresponding value.
   */
  private _selectValue(value: any): NxDropdownItemComponent | undefined {
    const correspondingOption = this.options.find((option: NxDropdownItemComponent) => {
      try {
        // Treat null as a special reset value.
        return option.value != null && this._compareWith(option.value, value);
      } catch (error) {
        if (isDevMode()) {
          // Notify developers of errors in their comparator.
          console.warn(error);
        }
        return false;
      }
    });

    if (correspondingOption) {
      this._selectionModel.select(correspondingOption);
    }
    return correspondingOption;
  }

  /** Emits change event to set the model value. */
  private _propagateChanges(fallbackValue?: any): void {
    let valueToEmit: any = null;

    if (this.isMultiSelect) {
      valueToEmit = (this.selected as NxDropdownItemComponent[]).map(option => option.value);
    } else {
      valueToEmit = this.selected ? (this.selected as NxDropdownItemComponent).value : fallbackValue;
    }

    this._value = valueToEmit;
    this.valueChange.emit(valueToEmit);
    this._onChange(valueToEmit);
    this.selectionChange.emit(new NxDropdownSelectChange(this, valueToEmit));
    this._changeDetectorRef.markForCheck();
  }

  /** Sorts the selected values in the selected based on their order in the panel. */
  private _sortValues() {
    if (this.isMultiSelect) {
      const options = this.options.toArray();
      this._selectionModel.sort((a, b) => options.indexOf(a) - options.indexOf(b));
      this.stateChanges.next();
    }
  }

  /** Adds a offset to the overlay position, so the formfield label and the dropdown panel header are vertically aligned. */
  private _updatePositionOffset() {
    let offset = 0;

    if (this.formFieldComponent !== null) {
      const formFieldRect = this.formFieldComponent.elementRef.nativeElement.getBoundingClientRect();
      const dropdownRect = this._elementRef.nativeElement.getBoundingClientRect();
      const panelHeader = this.overlayDir.overlayRef.overlayElement.querySelector('.nx-dropdown__panel-header');
      const panelHeaderPaddingTop = panelHeader ? parseInt(getComputedStyle(panelHeader).paddingTop, 10) : 0;
      offset = formFieldRect.top - dropdownRect.top - panelHeaderPaddingTop;
    }

    this._positions[0].offsetY = offset;
  }

  /** Focuses the select element. */
  focus(): void {
    this._elementRef.nativeElement.focus();
  }

  /** Opens the panel of the dropdown. */
  openPanel() {
    if (this.disabled || !this.options || !this.options.length || this._panelOpen) {
      return;
    }
    this._panelOpen = true;
    this._triggerRect = this.trigger.nativeElement.getBoundingClientRect();
    this._keyManager.withHorizontalOrientation(null);
    this._highlightCorrectOption();
    this._changeDetectorRef.markForCheck();
  }

  /** Closes the panel of the dropdown. */
  closePanel() {
    if (this._panelOpen) {
      this._panelOpen = false;
      this.isStable = false;
      this._keyManager.withHorizontalOrientation('ltr');
      this._changeDetectorRef.markForCheck();
      this._onTouched();
      this.openedChange.emit(false);
      // defer the focus if the dropdown triggers actions that detach
      // a template/view from the DOM to prevent changed after checked errors
      setTimeout(() => this.focus());
    }
  }

  // calculate inital scrollTop when the dropdown opens
  // scrolls the selected item to the middle of the panel if possible
  private _calculateScrollTop() {
    // reset the scrolltop to make calculation easier
    this.panelBody.nativeElement.scrollTop = 0;

    if (!this.empty) {
      const offset = this._getItemOffset(this._keyManager.activeItem);
      const panelHeight = this.panelBody.nativeElement.offsetHeight;
      const panelRect = this.panelBody.nativeElement.getBoundingClientRect();
      const middleOfPanel = panelRect.top + panelHeight / 2;

      if (offset > middleOfPanel) {
        // because we reset the scrollTop to 0 at the top we can simply take the middleOfPanel which is our
        // target position for the item and subtract it from the offset (which is now always relative to the viewport)
        this.panelBody.nativeElement.scrollTop = offset - middleOfPanel;
      }
    }
  }

  /** Scrolls the active option into view. */
  private _scrollActiveOptionIntoView(): void {
    if (!this.panelOpen || !this._keyManager.activeItem) {
      return;
    }

    const activeItem = this._keyManager.activeItem.containerElement.nativeElement;
    const panel = this.panelBody.nativeElement;
    const panelOffset = panel.offsetTop;   // how much the overlay is repositioned on the page
    const panelTopScrollPosition = panel.scrollTop;
    const panelHeight = panel.clientHeight;
    const itemTop = activeItem.offsetTop - panelOffset;
    const itemBottom = activeItem.offsetTop - panelOffset + activeItem.getBoundingClientRect().height;

    // item half or less visible on top
    if (itemTop < panelTopScrollPosition) {
      this.panelBody.nativeElement.scrollTop = itemTop;
      // item half or less visible on bottom
    } else if (itemBottom > (panelTopScrollPosition + panelHeight)) {
      this.panelBody.nativeElement.scrollTop = itemBottom - panelHeight;
    }
  }

  /** @docs-private */
  private _getItemOffset(item) {
    const itemRect = item.containerElement.nativeElement.getBoundingClientRect();

    return itemRect.top + (itemRect.height / 2); // get position of the item's center
  }

  /**
   * @docs-private
   * Formfield Implementation
   */
  setDescribedByIds(ids: string[]): void {
    this.ariaDescribedby = ids.join(' ');
  }

  /**
   * @docs-private
   * aria-label support removed in favor of aria-labelledby
   * The NxFormfieldControl abstract class requires implementation
   * of below method.
   */
  setAriaLabel(value: string) {
    return value;
  }

  /**
   * @docs-private
   * Returns html ids of dropdown rendered value and label (if available),
   * separated by space.
   */
  _getAriaLabelledBy(): string {
    const valueId = this.renderedValueId;
    const labelId = this.formFieldComponent?.labelId;
    if (labelId) {
      return `${valueId} ${labelId}`;
    }
    return valueId;
  }

  get _isInOutlineField(): boolean {
    return this.formFieldComponent !== null
      && this.formFieldComponent.appearance === 'outline';
  }

  /**
   * @docs-private
   * Whether the select has a value.
   */
  get empty(): boolean {
    return !this._selectionModel || this._selectionModel.isEmpty();
  }

  /** @docs-private */
  get hasValue() {
    return this._selectionModel.hasValue();
  }

  /** @docs-private */
  get shouldLabelFloat(): boolean {
    return this.focused || !this.empty || !!(this.placeholder && this.placeholder.length > 0);
  }
  /** End Formfield */

  /** ControlValueAccessor */
  /**
   * Sets the select's value. Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   *
   * @param value New value to be written to the model.
   */
  writeValue(value: any): void {
    if (this.options) {
      this._setSelectionByValue(value);
    }
  }

  registerOnChange(fn: any): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  /**
   * Disables the select. Part of the ControlValueAccessor interface required
   * to integrate with Angular's core forms API.
   *
   * @param isDisabled Sets whether the component is disabled.
   */
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this._changeDetectorRef.markForCheck();
    this.stateChanges.next();
  }
  /** End ControlValueAccessor */

  _handleKeydown(event: KeyboardEvent) {
    this.panelOpen ? this._handleOpenKeydown(event) : this._handleClosedKeydown(event);
  }

  private _handleClosedKeydown(event: KeyboardEvent) {
    const keyCode = event.keyCode;
    const isArrowKey = keyCode === DOWN_ARROW || keyCode === UP_ARROW ||
      keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW;
    const isOpenKey = keyCode === ENTER || keyCode === SPACE;

    // Open the select on ALT + arrow key to match the native <select>
    if (isOpenKey || ((this.isMultiSelect || event.altKey) && isArrowKey)) {
      event.preventDefault(); // prevents the page from scrolling down when pressing space
      this.openPanel();
    } else if (!this.isMultiSelect && !this.disabled) {
      this._keyManager.onKeydown(event);
    }
  }

  private _handleOpenKeydown(event: KeyboardEvent) {
    const keyCode = event.keyCode;
    // if has filter all events other than the listed ones should be ignored or handled in _onFilter()
    if (!([DOWN_ARROW, UP_ARROW, HOME, END, ENTER, LEFT_ARROW, RIGHT_ARROW, SHIFT, SPACE, TAB].indexOf(keyCode) >= 0)
         && this.showFilter) {
      return;
    }

    const isArrowKey = keyCode === DOWN_ARROW || keyCode === UP_ARROW;
    const manager = this._keyManager;

    const allHidden = this.options.map(option => option._hidden).every(option => Boolean(option));

    if (keyCode === HOME || keyCode === END) {
      event.preventDefault();
      keyCode === HOME ? manager.setFirstItemActive() : manager.setLastItemActive();
    } else if (isArrowKey && event.altKey) {
      // Close the select on ALT + arrow key to match the native <select>
      event.preventDefault();
      this.closePanel();
    } else if (keyCode === ENTER && manager.activeItem && !allHidden) {
      event.preventDefault();

      manager.activeItem._selectViaInteraction();
    } else if (keyCode === ENTER && allHidden) {
      event.preventDefault();

      this.closePanel();
    } else if (!this.showFilter && keyCode === SPACE && manager.activeItem) {
      event.preventDefault();
      manager.activeItem._selectViaInteraction();
    } else if (keyCode === TAB) {
      this.closePanel();
    } else {
      const previouslyFocusedIndex = manager.activeItemIndex;
      manager.onKeydown(event);

      this._ngZone.onStable
        .asObservable()
      .pipe(
        take(1),
        delay(251) // we need to defer to get the new activeItemIndex. delay > debouncing of the typeAhead
       ).subscribe(() => {
          this.isStable = true;
          this._changeDetectorRef.detectChanges();
        });

      if (this.isMultiSelect && isArrowKey && event.shiftKey && manager.activeItem &&
        manager.activeItemIndex !== previouslyFocusedIndex) {
        manager.activeItem._selectViaInteraction();
      }
    }
  }

  /** @docs-private */
  formatValue(value): string {
    return this.valueFormatter(value);
  }

  /** Called when the user types in the filter input */
  _onFilter(event) {
    event.preventDefault();
    this.currentFilter = event.target.value;
    this.filterChanges.next(event.target.value);
    const allHidden = this.options.map(option => option._hidden).every(option => Boolean(option));
    if (allHidden) {
      this._keyManager.setActiveItem(null);
    } else {
      this._keyManager.setFirstItemActive();
    }

    const visibleItems = this.options.filter(option => !option._hidden);
    this.filterResultChange.next(visibleItems);
  }

  /**
   * @docs-private
   * The value displayed in the trigger.
   */
  get triggerValue(): string {

    if (this.empty) {
      return '';
    }

    if (this.isMultiSelect) {
      const selectedOptions = this._selectionModel.selected.map(option => option.viewValue);

      return selectedOptions.join(', ');
    }
    return this._selectionModel.selected[0].viewValue;
  }

  /**
   * Highlights the selected item. If no option is selected, it will highlight
   * the first item instead.
   */
  private _highlightCorrectOption(): void {
    if (this._keyManager) {
      if (this.empty) {
        this._keyManager.setFirstItemActive();
      } else {
        this._keyManager.setActiveItem(this._selectionModel.selected[0]);
      }
    }
  }

  /**
   * Callback that is invoked when the overlay panel has been attached.
   */
  _onAttached(): void {
    this.overlayDir.positionChange.pipe(take(1)).subscribe(() => {
      const overlayRef = this.overlayDir.overlayRef;
      const positionStrategy = overlayRef.getConfig()
        .positionStrategy as FlexibleConnectedPositionStrategy;

      this._updatePositionOffset();
      positionStrategy.withPositions(this._positions.slice());
      overlayRef.updatePosition();

      if (this._keyManager.activeItem) {
        this._calculateScrollTop();
      }

      this._changeDetectorRef.markForCheck();
      this.openedChange.emit(true);

      // If there is no item selected, the filter takes the focus.
      if (this.showFilter && !this._value) {
        this.filterInput.nativeElement.focus();
      } else {
        this.panelBody.nativeElement.focus();
      }
    });
  }

  _onFocus() {
    if (!this.disabled) {
      this._focused = true;
      this.stateChanges.next();
    }
  }

  /**
   * Calls the touched callback only if the panel is closed. Otherwise, the trigger will
   * "blur" to the panel when it opens, causing a false positive.
   */
  _onBlur() {
    this._focused = false;

    if (this.filterInput && this.showFilter) {
      this._clearFilter();
    }

    if (!this.disabled && !this.panelOpen) {
      this._onTouched();
      this._changeDetectorRef.markForCheck();
      this.stateChanges.next();
    }
  }

  /** @docs-private */
  get isFilterEmpty() {
    return this.currentFilter.length === 0;
  }

  /** @docs-private */
  _clearFilter() {
    this.filterInput.nativeElement.value = '';
    this.currentFilter = '';
    this.filterChanges.next('');
  }

  /** @docs-private determines the `aria-activedescendant` to be set on the host. */
  _getAriaActiveDescendant(): string | null {
    if (this.panelOpen && this._keyManager && this._keyManager.activeItem) {
      return this._keyManager.activeItem.id;
    }

    return null;
  }

  static ngAcceptInputType_disabled: BooleanInput;
}
