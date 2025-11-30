export namespace main {
	
	export class FileResult {
	    path: string;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new FileResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
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

}

