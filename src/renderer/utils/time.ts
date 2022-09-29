import { padNum } from './utils';

export class DateTime {
  constructor(
    public year: number = 1970,
    public month: number = 0,
    public day: number = 1,
    public hours: number = 0,
    public minutes: number = 0,
    public seconds: number = 0,
    public dayOfWeek: number = 0
  ) {}
}

export class Time {
  public static matchPattern = /\b\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d\b/;
  private static parsePattern =
    /\b(\d\d\d\d)-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)\b/;
  private static parseDatePattern = /\b(\d\d\d\d)-(\d\d)-(\d\d)\b/;

  // seconds since epoch
  private _seconds: number = 0;

  public get seconds(): number {
    return this._seconds;
  }

  private _dateTime: DateTime | undefined = undefined;

  public get dateTime(): DateTime {
    if (!this._dateTime) {
      let date: Date = new Date(this.seconds * 1000);
      this._dateTime = {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth(),
        day: date.getUTCDate(),
        hours: date.getUTCHours(),
        minutes: date.getUTCMinutes(),
        seconds: date.getUTCSeconds(),
        dayOfWeek: date.getUTCDay(),
      };
    }
    return this._dateTime;
  }

  public constructor(seconds: number = 0) {
    this._seconds = seconds;
  }

  public timeTo(time: Time): Time {
    return new Time(this.secondsTo(time));
  }

  public secondsTo(time: Time): number {
    return time.seconds - this.seconds;
  }

  public minutesTo(time: Time): number {
    return (time.seconds - this.seconds) / 60;
  }

  public get minutes() {
    return this.seconds / 60;
  }

  public get hours() {
    return this.seconds / 3600;
  }

  public getMinutesText() {
    let minutes = Math.floor(this.minutes);
    const hours = Math.floor(minutes / 60);
    minutes -= hours * 60;
    if (hours <= 0) {
      return `${minutes}m`;
    } else {
      return `${hours}h ${minutes}m`;
    }
  }

  public startOfWeek() {
    return this.addDays(-this.dateTime.dayOfWeek);
  }

  public startOfMondayWeek() {
    let dayOfWeek = this.dateTime.dayOfWeek - 1;
    if (dayOfWeek < 0) dayOfWeek += 7;
    return this.addDays(-dayOfWeek);
  }

  public startOfMonth() {
    return this.addDays(-(this.dateTime.day - 1));
  }

  public startOfYear() {
    const dateTime = this.dateTime;
    return Time.fromParams(
      dateTime.year,
      0,
      1,
      dateTime.hours,
      dateTime.minutes,
      dateTime.seconds
    );
  }

  public hoursTo(time: Time): number {
    return (time.seconds - this.seconds) / 3600;
  }

  public daysTo(time: Time): number {
    return (time.seconds - this.seconds) / 86400;
  }

  public add(time: Time): Time {
    return new Time(this.seconds + time.seconds);
  }

  public addSeconds(seconds: number): Time {
    return new Time(this.seconds + seconds);
  }

  public addMinutes(minutes: number): Time {
    return new Time(this.seconds + minutes * 60);
  }

  public addHours(hours: number): Time {
    return new Time(this.seconds + hours * 3600);
  }

  public addDays(days: number): Time {
    return new Time(this.seconds + days * 86400);
  }

  public addMonths(months: number): Time {
    const dateTime = this.dateTime;
    return Time.fromParams(
      dateTime.year,
      dateTime.month + months,
      dateTime.day,
      dateTime.hours,
      dateTime.minutes,
      dateTime.seconds
    );
  }

  public addYears(years: number): Time {
    const dateTime = this.dateTime;
    return Time.fromParams(
      dateTime.year + years,
      dateTime.month,
      dateTime.day,
      dateTime.hours,
      dateTime.minutes,
      dateTime.seconds
    );
  }

  public static now(): Time {
    return Time.fromDate(new Date());
  }

  public static nowMinute(): Time {
    return Time.fromDate(new Date()).floorTo(60);
  }

  public static epoch(): Time {
    return new Time(0);
  }

  public isEpoch(): boolean {
    return this.seconds === 0;
  }

  public static fromDate(date: Date): Time {
    let seconds =
      Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds()
      ) / 1000;
    return new Time(seconds);
  }

  public toDate() {
    const dateTime = this.dateTime;
    return new Date(
      dateTime.year,
      dateTime.month,
      dateTime.day,
      dateTime.hours,
      dateTime.minutes,
      dateTime.seconds
    );
  }

  public static fromDateTime(dateTime: DateTime): Time {
    let seconds =
      Date.UTC(
        dateTime.year,
        dateTime.month,
        dateTime.day,
        dateTime.hours,
        dateTime.minutes,
        dateTime.seconds
      ) / 1000;
    return new Time(seconds);
  }

  public static fromParams(
    year: number = 1970,
    month: number = 0,
    day: number = 1,
    hours: number = 0,
    minutes: number = 0,
    seconds: number = 0
  ): Time {
    return new Time(Date.UTC(year, month, day, hours, minutes, seconds) / 1000);
  }

  public static compare(a: Time, b: Time) {
    return a.seconds - b.seconds;
  }

  public static lessThan(a: Time, b: Time): boolean {
    return a.seconds < b.seconds;
  }

  public roundTo(interval: number): Time {
    return new Time(Math.round(this.seconds / interval) * interval);
  }

  public floorToDays() {
    return this.floorTo(86400);
  }

  public floorToHours() {
    return this.floorTo(3600);
  }

  public roundToDays() {
    return this.roundTo(86400);
  }

  public roundToHours() {
    return this.roundTo(3600);
  }

  public floorTo(interval: number): Time {
    return new Time(Math.floor(this.seconds / interval) * interval);
  }

  public ceilTo(interval: number): Time {
    return new Time(Math.ceil(this.seconds / interval) * interval);
  }

  public equals(time: Time): boolean {
    return this.seconds === time.seconds;
  }

  public lessThan(time: Time): boolean {
    return this.seconds < time.seconds;
  }

  public leq(time: Time): boolean {
    return this.seconds <= time.seconds;
  }

  public greaterThan(time: Time): boolean {
    return this.seconds > time.seconds;
  }

  public geq(time: Time): boolean {
    return this.seconds >= time.seconds;
  }

  public static min(a: Time, b: Time): Time {
    return a.lessThan(b) ? a : b;
  }

  public static max(a: Time, b: Time): Time {
    return a.greaterThan(b) ? a : b;
  }

  public toString(): string {
    return `${padNum(this.dateTime.year, 4)}-${padNum(
      this.dateTime.month + 1,
      2
    )}-${padNum(this.dateTime.day, 2)} ${padNum(
      this.dateTime.hours,
      2
    )}:${padNum(this.dateTime.minutes, 2)}:${padNum(this.dateTime.seconds, 2)}`;
  }

  public static fromString(text: string) {
    const m = text.match(Time.parsePattern);
    if (!m) {
      return undefined;
    }
    return Time.fromParams(
      parseInt(m[1], 10),
      parseInt(m[2], 10) - 1,
      parseInt(m[3], 10),
      parseInt(m[4], 10),
      parseInt(m[5], 10),
      parseInt(m[6], 10)
    );
  }

  public toDateString(): string {
    return `${padNum(this.dateTime.year, 4)}-${padNum(
      this.dateTime.month + 1,
      2
    )}-${padNum(this.dateTime.day, 2)}`;
  }

  public toMMString(): string {
    return `${padNum(this.dateTime.month + 1, 2)}`;
  }

  public toMMDDString(): string {
    return `${padNum(this.dateTime.month + 1, 2)}-${padNum(
      this.dateTime.day,
      2
    )}`;
  }

  public toYYYYMMString() {
    return `${padNum(this.dateTime.year, 4)}-${padNum(
      this.dateTime.month + 1,
      2
    )}`;
  }

  public toYYYYString() {
    return `${padNum(this.dateTime.year, 4)}`;
  }

  public static fromDateString(text: string) {
    const m = text.match(Time.parseDatePattern);
    if (!m) {
      return undefined;
    }
    return Time.fromParams(
      parseInt(m[1], 10),
      parseInt(m[2], 10) - 1,
      parseInt(m[3], 10),
      0,
      0,
      0
    );
  }

  public static fromStringOrDefault(text: string, defaultTime: Time) {
    const time = this.fromString(text);
    if (time === undefined) return defaultTime;
    return time;
  }
}
