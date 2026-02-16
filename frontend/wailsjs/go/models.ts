export namespace main {
	
	export class FileResult {
	    label: string;
	    path: string;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new FileResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.path = source["path"];
	        this.size = source["size"];
	    }
	}
	export class ConvertResult {
	    primary: FileResult;
	    secondary: FileResult;
	
	    static createFrom(source: any = {}) {
	        return new ConvertResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.primary = this.convertValues(source["primary"], FileResult);
	        this.secondary = this.convertValues(source["secondary"], FileResult);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EncodeOptions {
	    codec: string;
	    audio: string;
	    extension: string;
	    outputPath: string;
	    outputDirType: string;
	
	    static createFrom(source: any = {}) {
	        return new EncodeOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.codec = source["codec"];
	        this.audio = source["audio"];
	        this.extension = source["extension"];
	        this.outputPath = source["outputPath"];
	        this.outputDirType = source["outputDirType"];
	    }
	}
	
	export class InputConfig {
	    mode: string;
	    paths: string[];
	
	    static createFrom(source: any = {}) {
	        return new InputConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mode = source["mode"];
	        this.paths = source["paths"];
	    }
	}
	export class MediaInfo {
	    path: string;
	    size: number;
	    hasVideo: boolean;
	    hasAudio: boolean;
	    duration: number;
	
	    static createFrom(source: any = {}) {
	        return new MediaInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.size = source["size"];
	        this.hasVideo = source["hasVideo"];
	        this.hasAudio = source["hasAudio"];
	        this.duration = source["duration"];
	    }
	}
	export class OutputConfig {
	    label: string;
	    dirType: string;
	    customDir: string;
	    nameMode: string;
	    nameValue: string;
	    extension: string;
	    ffmpegOptions: string[];
	
	    static createFrom(source: any = {}) {
	        return new OutputConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.dirType = source["dirType"];
	        this.customDir = source["customDir"];
	        this.nameMode = source["nameMode"];
	        this.nameValue = source["nameValue"];
	        this.extension = source["extension"];
	        this.ffmpegOptions = source["ffmpegOptions"];
	    }
	}
	export class ProcessRequest {
	    fileId: string;
	    input: InputConfig;
	    globalOptions: string[];
	    outputs: OutputConfig[];
	
	    static createFrom(source: any = {}) {
	        return new ProcessRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.fileId = source["fileId"];
	        this.input = this.convertValues(source["input"], InputConfig);
	        this.globalOptions = source["globalOptions"];
	        this.outputs = this.convertValues(source["outputs"], OutputConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ProcessResult {
	    results: FileResult[];
	
	    static createFrom(source: any = {}) {
	        return new ProcessResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.results = this.convertValues(source["results"], FileResult);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

