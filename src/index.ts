/* eslint-disable @typescript-eslint/explicit-member-accessibility, @typescript-eslint/no-unnecessary-type-assertion */
import { Transform, TransformCallback, TransformOptions } from 'stream';

const INTERLACING_MODES = 'ptbm';

export type ColourSpaces =
	| 'Cmono'
	| 'C420'
	| 'C420jpeg'
	| 'C420paldv'
	| 'C420mpeg2'
	| 'C420p10'
	| 'C420p12'
	| 'C411'
	| 'C422'
	| 'C422jpeg'
	| 'C422p10'
	| 'C422p12'
	| 'C444'
	| 'C444p10'
	| 'C444p12';

export interface HeaderOptions {
	/**
	 * The width of the frame in pixels.
	 */
	width: number;
	/**
	 * The height of the frame in pixels.
	 */
	height: number;
	/**
	 * The frame rate of the video.
	 */
	frameRate: Ratio;
	/**
	 * The interlacing mode of the video.
	 * @default 'p'
	 */
	interlacing?: 'p' | 't' | 'b' | 'm';
	/**
	 * The pixel aspect ratio of the video.
	 * @default new Ratio(0, 0) - means "unknown aspect ratio"
	 */
	aspectRatio?: Ratio;
	/**
	 * The colour space of the video.
	 * @default 'C420'
	 */
	colourSpace?: ColourSpaces;
	/**
	 * The optional comment in the header.
	 * It cannot contain spaces or
	 * the TERMINATOR char (`'\x0A'`).
	 */
	comment?: string;
}

export class Header {
	/**
	 * The width of the frame in pixels.
	 */
	public width: number;
	/**
	 * The height of the frame in pixels.
	 */
	public height: number;
	/**
	 * The frame rate of the video.
	 */
	public frameRate: Ratio;
	/**
	 * The interlacing mode of the video.
	 * @default 'p'
	 */
	public interlacing: 'p' | 't' | 'b' | 'm';
	/**
	 * The pixel aspect ratio of the video.
	 * @default new Ratio(0, 0) - means "unknown aspect ratio"
	 */
	public aspectRatio: Ratio;
	/**
	 * The colour space of the video.
	 * @default 'C420'
	 */
	public colourSpace: ColourSpace;
	/**
	 * The optional comment in the header.
	 * It cannot contain spaces or
	 * the TERMINATOR char (`'\x0A'`).
	 */
	public comment: string | undefined;

	public constructor({
		width,
		height,
		frameRate,
		interlacing = 'p',
		aspectRatio = new Ratio(0, 0),
		colourSpace = 'C420',
		comment,
	}: HeaderOptions) {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (!width || !height || !frameRate) {
			throw new Error('Invalid header: missing or invalid required parameters.');
		}
		if (!INTERLACING_MODES.includes(interlacing)) {
			throw new Error('Invalid header: interlacing mode is invalid.');
		}
		if (comment && (comment.includes(String.fromCharCode(TERMINATOR)) || comment.includes(FIELD_SEPARATOR))) {
			throw new Error('Invalid header: comment contains illegal characters.');
		}
		this.width = width;
		this.height = height;
		this.frameRate = frameRate;
		this.interlacing = interlacing;
		this.aspectRatio = aspectRatio;
		this.colourSpace = new ColourSpace(colourSpace, width * height);
		this.comment = comment;
	}

	public toString() {
		return (
			`W${this.width} H${this.height} F${this.frameRate} I${this.interlacing} A${this.aspectRatio} ${this.colourSpace}` +
			(this.comment ? ` X${this.comment}` : '')
		);
	}
}

// eslint-disable-next-line unicorn/prevent-abbreviations
function parseUint(str: string) {
	const n = +str;
	return n && n > 0 && n < Infinity && n;
}

export class Ratio {
	public static readonly SEPARATOR = ':';
	/**
	 * The ratio's numerator.
	 */
	public num: number;
	/**
	 * The ratio's denominator.
	 */
	public den: number;

	/**
	 * @param num The ratio's numerator.
	 * @param den The ratio's denominator.
	 */
	// eslint-disable-next-line unicorn/prevent-abbreviations
	public constructor(num: number, den: number) {
		this.num = num;
		this.den = den;
	}

	/**
	 * @param ratio The stringified ratio, in format 'num:den'.
	 * @returns The parsed ratio.
	 * @throws {Error} If the ratio is invalid.
	 */
	public static fromString(ratio: string) {
		const parts = ratio.split(Ratio.SEPARATOR);
		if (parts.length !== 2) {
			throw new Error('Invalid ratio: invalid format.');
		}
		// eslint-disable-next-line unicorn/prevent-abbreviations
		const num = parseUint(parts[0]);
		const den = parseUint(parts[1]);
		if (!num || !den) {
			throw new Error('Invalid ratio: invalid numerator or denominator.');
		}
		return new Ratio(num, den);
	}

	public toString(): string {
		return `${this.num}:${this.den}`;
	}
}

const COLOUR_SPACES = {
	Cmono: 0,
	C420: 0.25,
	C420jpeg: 0.25,
	C420paldv: 0.25,
	C420mpeg2: 0.25,
	C420p10: 0.25,
	C420p12: 0.25,
	C411: 0.25,
	C422: 0.5,
	C422jpeg: 0.5,
	C422p10: 0.5,
	C422p12: 0.5,
	C444: 1,
	C444p10: 1,
	C444p12: 1,
};

class ColourSpace {
	/**
	 * The colour space name.
	 */
	public name: ColourSpaces;
	/**
	 * The colour space's bit depth.
	 */
	public bitDepth: 8 | 16;
	/**
	 * The number of bytes per sample.
	 */
	public bytesPerSample: 1 | 2;
	/**
	 * The planes (Y, U, and V) sizes in bytes.
	 */
	public planesSizes: [y: number, u: number, v: number];
	/**
	 * The total size of a frame in bytes.
	 */
	public frameSize: number;

	public constructor(name: ColourSpaces, pixels: number) {
		const factor = COLOUR_SPACES[name];
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (factor === undefined) {
			throw new Error('Invalid colour space: unknown name.');
		}
		this.name = name;
		this.bitDepth = name[5] === '1' ? 16 : 8;
		this.bytesPerSample = (this.bitDepth / 8) as 1 | 2;
		const chromaSize = Math.ceil(pixels * factor * this.bytesPerSample);
		this.planesSizes = [pixels * this.bytesPerSample, chromaSize, chromaSize];
		this.frameSize = this.planesSizes[0] + 2 * chromaSize;
	}

	public toString() {
		return this.name;
	}
}

export class Frame {
	/**
	 * The frame's data.
	 */
	public data: Buffer;
	/**
	 * The frame's raw parameters.
	 * `undefined` if there's no parameters.
	 */
	public rawParameters: Buffer | undefined;
	/**
	 * @param data The frame's data.
	 * @param rawParamaters The frame's raw parameters.
	 */
	public constructor(data: Buffer, rawParamaters?: Buffer) {
		this.data = data;
		this.rawParameters = rawParamaters;
	}
}

const SIGNATURE = Buffer.from('YUV4MPEG2 ', 'ascii');
const FRAME_SIGNATURE = Buffer.from('FRAME', 'ascii');
const TERMINATOR = 0x0a;
const TERMINATOR_BUFFER = Buffer.from([TERMINATOR]);
const FIELD_SEPARATOR = ' ';

const enum DecoderState {
	HEADER,
	FRAME,
	FRAME_DATA,
}

export interface DecoderOptions extends TransformOptions {
	/**
	 * The maximum frame size in bytes.
	 * @default Infinity
	 */
	maxFrameSize?: number;
}

interface DecoderEvents {
	close: [this: Decoder<true>];
	data: [this: Decoder<true>, frame: Frame];
	header: [this: Decoder<true>, header: Header];
	end: [this: Decoder<true>];
	error: [this: this, error: Error];
	pause: [];
	readable: [this: Decoder<true>];
	resume: [];
}

type Listener<Args extends unknown[]> = Args extends [infer This, ...infer A]
	? (this: This, ...args: A) => void
	: (...args: Args) => void;

type Pop<T extends unknown[]> = T extends [unknown, ...infer B] ? B : T;

// @ts-expect-error `this` is correct
export interface Decoder {
	on<K extends keyof DecoderEvents>(event: K, listener: Listener<DecoderEvents[K]>): this;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	on(event: string | symbol, listener: (...args: any[]) => void): this;
	addListener: Decoder['on'];
	once: Decoder['on'];
	prependListener: Decoder['on'];
	prependOnceListener: Decoder['on'];
	emit<K extends keyof DecoderEvents>(event: K, ...args: Pop<DecoderEvents[K]>): boolean;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	emit(event: string | symbol, ...args: any[]): this;
	removeListener: Decoder['on'];
	off: Decoder['on'];
	removeAllListeners<K extends keyof DecoderEvents>(event?: K): this;
	removeAllListeners(event?: string | symbol): this;
	[Symbol.asyncIterator](): AsyncIterableIterator<Frame>;
}

// @ts-expect-error `this` is correct
// eslint-disable-next-line no-redeclare
export class Decoder<HeaderReady = false> extends Transform {
	/**
	 * The current state of the parser
	 */
	#state: DecoderState | undefined = DecoderState.HEADER;
	#remainder: Buffer | undefined;
	#dataNeeded: number | undefined;
	#frame: Frame | undefined;
	#frameOffset: number | undefined;

	/**
	 * The maximum frame size of a frame in bytes.
	 * @default Infinity
	 */
	public readonly maxFrameSize: number;
	/**
	 * The video header.
	 * Only available after the `'header'` event
	 * (and obviously in `'data'`, `'readable'`, `'close'`, and `'end'` events).
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public header: HeaderReady extends true ? Header : Header | undefined = undefined as any;

	public constructor({ maxFrameSize, ...transformOptions }: DecoderOptions = {}) {
		transformOptions.readableObjectMode = true;
		transformOptions.writableObjectMode = false;
		super(transformOptions);
		this.maxFrameSize = !maxFrameSize || maxFrameSize <= 0 ? Infinity : maxFrameSize;
	}

	#parseHeader(rawParameters: string[]) {
		const parameters = Object.create(null);
		// eslint-disable-next-line unicorn/no-for-loop
		for (let i = 0; i < rawParameters.length; i++) {
			const parameter = rawParameters[i];
			const v = parameter.slice(1);
			switch (parameter[0]) {
				case 'W':
					parameters.width = parseUint(v);
					break;
				case 'H':
					parameters.height = parseUint(v);
					break;
				case 'F':
					parameters.frameRate = Ratio.fromString(v);
					break;
				case 'I':
					parameters.interlacing = v;
					break;
				case 'A':
					parameters.aspectRatio = Ratio.fromString(v);
					break;
				case 'C':
					parameters.colourSpace = parameter;
					break;
				case 'X':
					parameters.comment = v;
					break;
			}
		}
		this.header = new Header(parameters);
		if (this.header.colourSpace.frameSize > this.maxFrameSize)
			throw new Error('Frame size exceeds the maximum frame size limit.');
		this.emit('header', this.header);
	}

	// eslint-disable-next-line sonarjs/cognitive-complexity
	public _transform(
		this: Decoder<true>,
		chunk: Buffer,
		_encoding: BufferEncoding | undefined,
		callback: TransformCallback,
	) {
		if (this.#remainder !== undefined) {
			chunk = Buffer.concat([this.#remainder, chunk]);
		}

		let terminatorIndex!: number;
		if (this.#dataNeeded !== undefined) {
			if (chunk.length < this.#dataNeeded) {
				this.#remainder = chunk;
				callback();
				return;
			}
			this.#remainder = undefined;
			this.#dataNeeded = undefined;
		} else {
			if ((terminatorIndex = chunk.indexOf(TERMINATOR)) === -1) {
				this.#remainder = chunk;
				callback();
				return;
			}
			this.#remainder = undefined;
		}

		switch (this.#state) {
			case DecoderState.FRAME_DATA: {
				let length = this.header.colourSpace.frameSize;

				if (this.#frameOffset) {
					length -= this.#frameOffset;
					chunk.copy(this.#frame!.data, this.#frameOffset, 0, length);
				} else {
					this.#frame!.data = chunk.slice(0, length);
				}
				this.push(this.#frame);
				this.#frame = undefined;

				this.#state = DecoderState.FRAME;

				if (chunk.length > length) {
					this._transform(chunk.slice(length), undefined, callback);
				} else callback();
				return;
			}

			case DecoderState.FRAME: {
				const frameSize = this.header.colourSpace.frameSize;
				for (;;) {
					if (chunk.compare(FRAME_SIGNATURE, 0, FRAME_SIGNATURE.length, 0, FRAME_SIGNATURE.length) !== 0) {
						callback(new Error('Invalid frame signature.'));
						return;
					}

					const remaining = chunk.length - terminatorIndex - 1;

					const rawParameters =
						terminatorIndex === FRAME_SIGNATURE.length
							? undefined
							: chunk.slice(FRAME_SIGNATURE.length, terminatorIndex);

					if (remaining >= frameSize) {
						const end = terminatorIndex + 1 + frameSize;
						this.push(new Frame(chunk.slice(terminatorIndex + 1, terminatorIndex + 1 + frameSize), rawParameters));
						if (chunk.includes(TERMINATOR, end)) {
							chunk = chunk.slice(end);
							continue;
						} else if (remaining > frameSize) {
							this._transform(chunk.slice(end), undefined, callback);
						} else callback();
						return;
					}

					this.#state = DecoderState.FRAME_DATA;
					this.#dataNeeded = frameSize - remaining;
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					this.#frame = new Frame(undefined as any, rawParameters);
					if (remaining > 0) {
						this.#frame.data = Buffer.alloc(frameSize);
						chunk.copy(this.#frame.data, 0, terminatorIndex + 1);
						this.#frameOffset = remaining;
					}
					callback();
					return;
				}
			}

			case DecoderState.HEADER: {
				if (chunk.compare(SIGNATURE, 0, SIGNATURE.length, 0, SIGNATURE.length) !== 0) {
					callback(new Error('Invalid signature.'));
					return;
				}

				const rawParameters = chunk.slice(SIGNATURE.length, terminatorIndex).toString('ascii').split(FIELD_SEPARATOR);
				if (rawParameters.length < 3) {
					callback(new Error('Invalid header.'));
					return;
				}

				try {
					this.#parseHeader(rawParameters);
				} catch (error) {
					callback(error as Error);
					return;
				}

				this.#state = DecoderState.FRAME;
				if (terminatorIndex === chunk.length - 1) {
					callback();
					return;
				}
				this._transform(chunk.slice(terminatorIndex + 1), undefined, callback);
			}
		}
	}

	#cleanup() {
		this.#remainder = undefined;
		this.#dataNeeded = undefined;
		this.#frame = undefined;
		this.#frameOffset = undefined;
		this.#state = undefined;
	}

	public _final(callback: TransformCallback) {
		if (!this.header || this.#frame) {
			callback(new Error('Not finished'));
			return;
		}
		callback();
	}

	public _destroy(error: Error | null, callback: (error: Error | null) => void): void {
		this.#cleanup();
		callback(error);
	}
}

/**
 * @param options Decoder's options.
 * @returns A `Decoder` instance.
 */
export function decoder(options?: DecoderOptions) {
	return new Decoder(options);
}

interface EncoderOptions extends TransformOptions {
	/**
	 * The `Header` of the video.
	 */
	header: Header;
}

export class Encoder extends Transform {
	constructor({ header, ...transformOptions }: EncoderOptions) {
		transformOptions.writableObjectMode = true;
		transformOptions.readableObjectMode = false;
		super(transformOptions);
		if (!(header instanceof Header)) throw new Error('Invalid header.');
		this.push(SIGNATURE);
		this.push(Buffer.from(header + String.fromCharCode(TERMINATOR), 'ascii'));
	}

	_transform(frame: Frame, _encoding: BufferEncoding | undefined, callback: TransformCallback) {
		this.push(FRAME_SIGNATURE);
		if (frame.rawParameters) this.push(frame.rawParameters);
		this.push(TERMINATOR_BUFFER);
		this.push(frame.data);
		callback();
	}

	_flush(callback: TransformCallback) {
		callback();
	}
}

/**
 * @param options Encoder's options.
 * @returns A `Encoder` instance.
 */
export function encoder(options: EncoderOptions) {
	return new Encoder(options);
}
