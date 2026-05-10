<?php

namespace App\Providers;

use App\Models\Trip;
use App\Observers\TripObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        //
    }

    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        Trip::observe(TripObserver::class);
    }
}
