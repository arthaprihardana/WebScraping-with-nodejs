function deferClass() {
	this._callbacks=[];
	this._ecallbacks=[];
}
deferClass.prototype._call=function(values){
	var arg=Array.prototype.slice.call(arguments);
	//console.log('call dipanggil',this._callbacks);
	(this._callbacks.shift()).apply(this,arg);
	return this;
};
deferClass.prototype.then=function(f){
	f=(f && f instanceof Array)?f:(f?[f]:[]);
	this._callbacks.push.apply(this._callbacks,f);
	return this;
};
deferClass.prototype.resolve=function(value){
	var x=Array.prototype.slice.call(arguments);
	this.value=x;
	if(this._callbacks.length){
		this._call.apply(this,x);
	}
	return this;
};
deferClass.prototype._reject=function(reason){
	while (this._ecallbacks.length) {
		(this._ecallbacks.shift()).apply(this,[reason]);
	}
}
deferClass.prototype.reject=function(reason){
	this._reject(reason);
	return this;
}
deferClass.prototype.catch=function(f){
	this._ecallbacks.push(f);
	return this;
}
deferClass.prototype.done=function(onSuccess,onError){
	if (onSuccess) { this._callbacks.push(onSuccess); }
	if (onError) { this._ecallbacks.push(onError); }
	this._call();
	return this;
}
function deferred(f){
	return (new deferClass()).then(f);
}

module.exports=deferred;